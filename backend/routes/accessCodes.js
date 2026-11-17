import express from 'express'
import rateLimit from 'express-rate-limit'
import { getPool } from '../config/database.js'
import { authenticateAdmin } from '../middleware/auth.js'
import { validate, accessCodeSchema, validateAccessCodeSchema } from '../middleware/validation.js'

const router = express.Router()

const validateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many validation attempts, please try again later." }
})

const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: "Too many admin requests, please try again later." }
})

const checkAccessCodeValidity = (code, userIdentifier) => {
  const now = new Date();
  if (code.status !== 'active') return { valid: false, reason: 'Access code is disabled' };
  if (new Date(code.expires_at) < now) return { valid: false, reason: 'Access code has expired' };
  if (code.used_count >= code.max_uses) return { valid: false, reason: 'Access code usage limit reached' };
  if (code.allowed_user && userIdentifier && code.allowed_user !== userIdentifier.toLowerCase()) {
    return { valid: false, reason: 'Access code not valid for this user' };
  }
  return { valid: true };
}

router.post('/validate', validateRateLimit, validate(validateAccessCodeSchema), async (req, res, next) => {
  try {
    const pool = getPool();
    const { code, userIdentifier } = req.body;
    const [rows] = await pool.execute('SELECT * FROM access_codes WHERE code = ?', [code.toUpperCase()]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid access code' });
    }
    const validation = checkAccessCodeValidity(rows[0], userIdentifier);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.reason });
    }
    res.status(200).json({
      success: true,
      message: 'Access code is valid',
      data: { code: rows[0].code, remainingUses: rows[0].max_uses - rows[0].used_count }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', adminRateLimit, authenticateAdmin, validate(accessCodeSchema), async (req, res, next) => {
  try {
    const pool = getPool();
    const { code, expiresAt, maxUses, allowedUser } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO access_codes (code, expires_at, max_uses, allowed_user) VALUES (?, ?, ?, ?)',
      [code.toUpperCase(), expiresAt, maxUses, allowedUser?.toLowerCase() || null]
    );
    const [created] = await pool.execute('SELECT * FROM access_codes WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Access code created successfully', data: created[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Access code already exists' });
    }
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

    const [codes] = await pool.execute(
      `SELECT * FROM access_codes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM access_codes ${where}`,
      params
    );
    res.status(200).json({
      success: true,
      data: codes,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: countResult[0].total, pages: Math.ceil(countResult[0].total / limit) }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', adminRateLimit, authenticateAdmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be active or disabled' });
    }
    const [result] = await pool.execute('UPDATE access_codes SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Access code not found' });
    }
    const [updated] = await pool.execute('SELECT * FROM access_codes WHERE id = ?', [req.params.id]);
    res.status(200).json({ success: true, message: 'Access code updated successfully', data: updated[0] });
  } catch (error) {
    next(error);
  }
});

export default router
