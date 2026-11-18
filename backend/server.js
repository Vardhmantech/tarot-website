import dotenv from "dotenv";
import express from "express";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import connectDB from "./config/database.js";
import bookingRoutes from "./routes/bookings.js";
import contactRoutes from "./routes/contact.js";
import accessCodeRoutes from "./routes/accessCodes.js";
import authRoutes from "./routes/auth.js";
import paymentRoutes from "./routes/payments.js";
import pricingRoutes from "./routes/pricing.js";
import contentRoutes from "./routes/content.js";
import servicesRoutes from "./routes/services.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { serializeResponse } from "./utils/serialize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env regardless of the directory the process was started from.
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5000;
const frontendDist = path.resolve(__dirname, "..", "frontend", "dist");
const hasFrontendBuild = fs.existsSync(path.join(frontendDist, "index.html"));

app.disable("x-powered-by");
app.set("trust proxy", 1);

// Razorpay signs the raw request body, so this route must be parsed before express.json().
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

const cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
  formAction: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
  frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
  imgSrc: ["'self'", "data:", "blob:", "https:"],
  objectSrc: ["'none'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  connectSrc: [
    "'self'",
    "https://api.razorpay.com",
    "https://checkout.razorpay.com",
    "https://lumberjack.razorpay.com"
  ]
};

app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? { directives: cspDirectives } : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
  })
);

app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (Buffer.isBuffer(obj)) return obj;
    if (typeof obj === "string") {
      return obj
        .replace(/<script[^>]*>.*?<\/script>/gi, "")
        .replace(/<[^>]*>/g, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+=/gi, "");
    }
    if (typeof obj === "object" && obj !== null) {
      for (let key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health"
});
app.use("/api", limiter);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  "https://krushnalaya.in",
  "https://www.krushnalaya.in",
  "http://krushnalaya.in",
  "http://www.krushnalaya.in",
  "http://localhost:3000",
  "https://localhost:3000",
  "http://localhost:5173",
  "https://localhost:5173",
  "http://localhost:5174",
  "https://localhost:5174"
].filter(Boolean);

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const requestOrigin = `${req.protocol}://${req.get("host")}`;
    const isHostingerPreview = /^https:\/\/[a-z0-9-]+\.hostingersite\.com$/i.test(origin || "");

    const allowed =
      !origin ||
      origin === requestOrigin ||
      allowedOrigins.includes(origin) ||
      isHostingerPreview ||
      process.env.NODE_ENV !== "production";

    callback(null, {
      origin: allowed,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"]
    });
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Keep API responses compatible with the camelCase fields used by the React app.
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(serializeResponse(body));
  next();
});

app.use("/api/bookings", bookingRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/access-codes", accessCodeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/services", servicesRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Tarot Website API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    frontend: hasFrontendBuild ? "built" : "missing"
  });
});

// Unknown API routes must stay JSON; they must not fall through to the SPA.
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Serve the production React build from the same domain as the API.
if (hasFrontendBuild) {
  app.use(
    express.static(frontendDist, {
      index: false,
      maxAge: "7d",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store, must-revalidate");
        }
      }
    })
  );

  app.get("*", (req, res, next) => {
    if (req.method !== "GET" || path.extname(req.path)) return next();
    res.setHeader("Cache-Control", "no-store, must-revalidate");
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.status(503).json({
      success: false,
      message: "Frontend build not found. Run `npm run build` before starting the server."
    });
  });
}

app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});

const start = async () => {
  await connectDB();

  if (process.env.USE_HTTPS === "true") {
    try {
      const httpsOptions = {
        key: fs.readFileSync("./key.pem"),
        cert: fs.readFileSync("./cert.pem")
      };
      https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`🔮 HTTPS Server running on port ${PORT}`);
        console.log(`🔒 URL: https://localhost:${PORT}`);
        console.log(`✨ Environment: ${process.env.NODE_ENV}`);
      });
    } catch (error) {
      console.error("❌ HTTPS setup failed:", error.message);
      process.exit(1);
    }
  } else {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🔮 Server running on port ${PORT}`);
      console.log(`✨ Environment: ${process.env.NODE_ENV}`);
      console.log(`🖥️  Frontend: ${hasFrontendBuild ? frontendDist : "not built"}`);
      console.log(`🔒 Security: Enhanced`);
      console.log(`🔑 Admin Key loaded: ${process.env.ADMIN_KEY ? "Yes" : "No"}`);
      console.log(`🔐 JWT Secret loaded: ${process.env.JWT_SECRET ? "Yes" : "No"}`);
      console.log(`💳 Razorpay Key ID loaded: ${process.env.RAZORPAY_KEY_ID ? "Yes" : "No"}`);
    });
  }
};

start().catch((error) => {
  console.error("❌ Failed to start server:", error.message);
  process.exit(1);
});
