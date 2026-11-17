import express from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [services] = await pool.execute('SELECT * FROM services WHERE is_active = TRUE ORDER BY display_order ASC');
    services.forEach(s => { if (s.features) s.features = typeof s.features === 'string' ? JSON.parse(s.features) : s.features; });
    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
})

router.get('/admin/all', authenticateAdmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const [services] = await pool.execute('SELECT * FROM services ORDER BY display_order ASC');
    services.forEach(s => { if (s.features) s.features = typeof s.features === 'string' ? JSON.parse(s.features) : s.features; });
    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
})

router.get('/:serviceType', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM services WHERE service_type = ? AND is_active = TRUE', [req.params.serviceType]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Service not found' });
    const service = rows[0];
    if (service.features) service.features = typeof service.features === 'string' ? JSON.parse(service.features) : service.features;
    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
})

router.put('/:serviceType', authenticateAdmin, [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('shortDescription').optional().trim().isLength({ max: 200 }).withMessage('Short description max 200 chars'),
  body('fullDescription').optional().trim().notEmpty().withMessage('Full description cannot be empty'),
  body('features').optional().isArray().withMessage('Features must be an array'),
  body('duration').optional().trim(),
  body('isActive').optional().isBoolean()
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const pool = getPool();
    const { title, shortDescription, fullDescription, features, duration, isActive, imageUrl, displayOrder } = req.body;

    const updates = [];
    const params = [];
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (shortDescription !== undefined) { updates.push('short_description = ?'); params.push(shortDescription); }
    if (fullDescription !== undefined) { updates.push('full_description = ?'); params.push(fullDescription); }
    if (features !== undefined) { updates.push('features = ?'); params.push(JSON.stringify(features)); }
    if (duration !== undefined) { updates.push('duration = ?'); params.push(duration); }
    if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive); }
    if (imageUrl !== undefined) { updates.push('image_url = ?'); params.push(imageUrl); }
    if (displayOrder !== undefined) { updates.push('display_order = ?'); params.push(displayOrder); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(req.params.serviceType);
    const [result] = await pool.execute(`UPDATE services SET ${updates.join(', ')} WHERE service_type = ?`, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const [updated] = await pool.execute('SELECT * FROM services WHERE service_type = ?', [req.params.serviceType]);
    const service = updated[0];
    if (service.features) service.features = typeof service.features === 'string' ? JSON.parse(service.features) : service.features;
    res.json({ success: true, message: 'Service updated successfully', data: service });
  } catch (error) {
    next(error);
  }
})

export default router
