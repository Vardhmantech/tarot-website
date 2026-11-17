import express from 'express'
import rateLimit from 'express-rate-limit'
import { getPool } from '../config/database.js'
import { validate, contactSchema } from '../middleware/validation.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many contact form submissions, please try again later." }
})

const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Too many admin requests, please try again later." }
})

router.post('/', contactRateLimit, validate(contactSchema), async (req, res, next) => {
  try {
    const pool = getPool();
    const { name, email, phone, subject, message } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO contacts (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone || null, subject, message]
    );
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { id: result.insertId, name, subject }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', adminRateLimit, authenticateAdmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND status = ?'; params.push(status); }

    const [messages] = await pool.execute(
      `SELECT * FROM contacts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM contacts ${where}`,
      params
    );

    res.status(200).json({
      success: true,
      data: messages,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: countResult[0].total, pages: Math.ceil(countResult[0].total / limit) }
    });
  } catch (error) {
    next(error);
  }
});

export default router
