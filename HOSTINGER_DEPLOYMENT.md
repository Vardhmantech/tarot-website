# Hostinger Deployment — Single Domain

This project is configured to run **the React frontend and Express API on one domain**:

```text
https://yourdomain.com/          -> React build
https://yourdomain.com/api/*     -> Express API
https://yourdomain.com/admin     -> React admin dashboard
```

The Express server in `backend/server.js` serves `frontend/dist` and all API routes. You do **not** need a separate `api.` subdomain, CORS setup, or `VITE_API_URL`.

## Requirements

- A Hostinger plan that supports **Node.js Web Apps**: Business Web Hosting, or a Cloud plan (Startup / Professional / Enterprise / Enterprise Plus).
- Node.js **20 or 22**. This repo targets Node 22 (`.nvmrc`).
- A Hostinger MySQL database.
- A GitHub repository connected through Hostinger's GitHub App for auto-deployment.

## 1. Create the MySQL database

In Hostinger hPanel:

1. Go to **Databases → MySQL Databases**.
2. Create a database and user. Save the database name, username, password, and host.
3. For a Node app on the same Hostinger server, use `DB_HOST=localhost`. Use the `srvXXXX.hstgr.io` host only for remote access from your computer.

### Create tables

On Hostinger, the easiest option is to import `backend/scripts/schema.sql` in **phpMyAdmin** (hPanel → Databases → phpMyAdmin → Import).

Alternatively, from your computer (with your IP allowed in hPanel → Remote MySQL), run:

```bash
cd backend
npm install
npm run db:create
npm run db:seed:services
npm run db:seed:content
```

If you are running from your computer against Hostinger's remote MySQL, first allow your IP in hPanel → **Remote MySQL**, and set `DB_HOST=srvXXXX.hstgr.io`.

## 2. Push to GitHub

The repository already ignores `.env`, `node_modules`, and build output. Do not commit real credentials.

```bash
git add .
git commit -m "Prepare single-domain Hostinger deployment"
git push origin main
```

## 3. Create the Hostinger Web App

In hPanel:

1. **Websites → Add Website → Node.js web app**.
2. Choose **Import your Git repository** and connect GitHub.
3. Select the repository and the `main` branch.
4. Use these deploy settings:

| Setting | Value |
|---|---|
| Framework preset | **Other** |
| Root directory | `/` (repository root) |
| Node.js version | **22** |
| Build command | `npm run build` |
| Output directory | Leave empty |
| Entry file | `backend/server.js` |
| Start command (if shown) | `npm start` |
| Package manager | npm |

Why output is empty: this is a server app. Hostinger keeps the whole repository and starts `backend/server.js`; the frontend is built into `frontend/dist` and served by Express.

The root `build` script installs backend production dependencies and builds the React app:

```text
cd backend && npm install --omit=dev
cd ../frontend && npm install --include=dev && npm run build
```

## 4. Add environment variables

In the Hostinger Web App dashboard, add these variables. Do **not** rely on uploading `.env`.

```env
NODE_ENV=production
DB_HOST=localhost
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

FRONTEND_URL=https://yourdomain.com
APP_URL=https://yourdomain.com

ADMIN_KEY=<64-character-random-string>
JWT_SECRET=<64-character-random-string>

RAZORPAY_KEY_ID=rzp_live_your_key
RAZORPAY_KEY_SECRET=your_live_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

USE_HTTPS=false
```

Optional Twilio variables:

```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not set `PORT` unless Hostinger explicitly asks for it; the app uses the port Hostinger provides.

## 5. Deploy and verify

Click **Deploy**. After the build finishes:

1. Open `https://yourdomain.com/api/health`.
   - Should return `status: "OK"` and `frontend: "built"`.
2. Open `https://yourdomain.com/`.
3. Open `https://yourdomain.com/admin` and log in with `ADMIN_KEY`.
4. Test a booking and a ₹1 Razorpay payment.
5. Check that the booking appears in the admin dashboard.

## 6. Razorpay webhook

In the Razorpay Dashboard → **Webhooks**, set:

```text
https://yourdomain.com/api/payments/webhook
```

Enable:

- `payment.captured`
- `payment.failed`

Use the same value for `RAZORPAY_WEBHOOK_SECRET`.

## Auto-deployment

After the first deployment, every push to the connected branch triggers a rebuild and redeploy. Hostinger manages the process and SSL.

Do not edit files inside `public_html` or `hbuilds/` manually; they are replaced on every deployment. Change the GitHub repository instead.

## Notes and limitations

- The app uses MySQL, not MongoDB. Older docs and `.env.template` files may still mention MongoDB.
- There is no migration framework yet. `backend/scripts/createTables.js` only creates missing tables; future column changes must be applied manually or through a migration tool.
- Seed scripts are destructive. Do not run `db:seed:all` on a live database with real bookings/content unless you intend to replace the services/content.
- Keep `frontend/.env.production`'s `VITE_API_URL` empty for this single-domain setup.
- Switch `rzp_test_...` keys to `rzp_live_...` before accepting real payments.
- If the site shows “Frontend build not found”, check the build logs and confirm `frontend/dist/index.html` exists.

## Troubleshooting

**`ERR_REQUIRE_ASYNC_MODULE`**
- Hostinger's LiteSpeed Node launcher loads the entry file with `require()`, which cannot load an ES module that uses top-level `await`.
- `backend/server.js` avoids top-level await by starting the database connection inside `start()`. Do not add top-level `await` to the entry file or anything it imports.

**Database access denied**
- Check `DB_HOST=localhost` when the app and database are on the same Hostinger server.
- Check the prefixed database/user names shown in hPanel.

**Site loads but API returns 404**
- Confirm the entry file is `backend/server.js`.
- Confirm `/api/health` works before testing the frontend.

**Payment modal is blocked**
- The Helmet CSP in `backend/server.js` allows Razorpay and Google Fonts. If Razorpay changes a domain, update the `connectSrc`/`frameSrc` lists.

**Build fails**
- Confirm the build command is exactly `npm run build`.
- Confirm the Node version is 20 or 22.
- If Hostinger auto-detects Vite or Express, switch the framework preset to **Other** and set the entry file to `backend/server.js`.
- The build deliberately installs frontend dev dependencies (`--include=dev`) so Vite is available even when `NODE_ENV=production`.
- Check the Hostinger Deployments → Build logs.
