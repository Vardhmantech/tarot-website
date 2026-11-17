import express from 'express';
import { body, validationResult } from 'express-validator';
import { getPool } from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [pricing] = await pool.execute('SELECT * FROM service_pricings WHERE is_active = TRUE');
    res.json({ success: true, data: pricing });
  } catch (error) {
    next(error);
  }
});

router.put('/:serviceId', authenticateAdmin, [
  body('price').isNumeric().withMessage('Price must be a number'),
  body('name').optional().trim()
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const pool = getPool();
    const { price, name, originalPrice, specialEvent, validUntil } = req.body;
    const [existing] = await pool.execute('SELECT * FROM service_pricings WHERE service_id = ?', [req.params.serviceId]);

    if (existing.length > 0) {
      const updates = ['price = ?'];
      const params = [price];
      if (name) { updates.push('name = ?'); params.push(name); }
      if (originalPrice !== undefined) { updates.push('original_price = ?'); params.push(originalPrice); }
      if (specialEvent !== undefined) { updates.push('special_event = ?'); params.push(specialEvent); }
      if (validUntil !== undefined) { updates.push('valid_until = ?'); params.push(validUntil); }
      params.push(req.params.serviceId);
      await pool.execute(`UPDATE service_pricings SET ${updates.join(', ')} WHERE service_id = ?`, params);
    } else {
      await pool.execute(
        'INSERT INTO service_pricings (service_id, name, price, original_price, special_event, valid_until) VALUES (?, ?, ?, ?, ?, ?)',
        [req.params.serviceId, name || req.params.serviceId, price, originalPrice || null, specialEvent || null, validUntil || null]
      );
    }

    const [updated] = await pool.execute('SELECT * FROM service_pricings WHERE service_id = ?', [req.params.serviceId]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/special-event', authenticateAdmin, [
  body('serviceId').notEmpty().withMessage('Service ID is required'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('specialEvent').notEmpty().withMessage('Event name is required')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const pool = getPool();
    const { serviceId, price, specialEvent, validUntil } = req.body;
    const [rows] = await pool.execute('SELECT * FROM service_pricings WHERE service_id = ?', [serviceId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Service not found' });

    await pool.execute(
      'UPDATE service_pricings SET original_price = price, price = ?, special_event = ?, valid_until = ? WHERE service_id = ?',
      [price, specialEvent, validUntil || null, serviceId]
    );
    const [updated] = await pool.execute('SELECT * FROM service_pricings WHERE service_id = ?', [serviceId]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/special-event/:serviceId', authenticateAdmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM service_pricings WHERE service_id = ?', [req.params.serviceId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Service not found' });

    const pricing = rows[0];
    const newPrice = pricing.original_price || pricing.price;
    await pool.execute(
      'UPDATE service_pricings SET price = ?, original_price = NULL, special_event = NULL, valid_until = NULL WHERE service_id = ?',
      [newPrice, req.params.serviceId]
    );
    const [updated] = await pool.execute('SELECT * FROM service_pricings WHERE service_id = ?', [req.params.serviceId]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
