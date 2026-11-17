import express from 'express'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { validate } from '../middleware/validation.js'
import Joi from 'joi'

const router = express.Router()

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many login attempts, please try again later." }
})

const loginSchema = Joi.object({
  adminKey: Joi.string().required().messages({ 'any.required': 'Admin key is required' })
})

router.post('/login', authRateLimit, validate(loginSchema), async (req, res, next) => {
  try {
    const { adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
    const token = jwt.sign(
      { role: 'admin', adminId: 'admin', iat: Math.floor(Date.now() / 1000) },
      process.env.JWT_SECRET,
      { expiresIn: '24h', issuer: 'krushnalaya-api' }
    );
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token, expiresIn: '24h', role: 'admin' }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: { role: decoded.role, adminId: decoded.adminId, expiresAt: new Date(decoded.exp * 1000) }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid token' });
    if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired' });
    next(error);
  }
});

export default router
