import express from 'express'
import rateLimit from 'express-rate-limit'
import { getPool } from '../config/database.js'
import { validate, bookingSchema } from '../middleware/validation.js'
import { authenticateAdmin } from '../middleware/auth.js'
import { getServicePrice } from '../utils/pricing.js'

const router = express.Router()

const bookingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Too many booking attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
})

const generateBookingNumber = () => {
  const prefix = 'KR'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}${timestamp}${random}`
}

const validateAccessCode = (code, userIdentifier) => {
  const now = new Date();
  if (code.status !== 'active') return { valid: false, reason: 'Access code is disabled' };
  if (new Date(code.expires_at) < now) return { valid: false, reason: 'Access code has expired' };
  if (code.used_count >= code.max_uses) return { valid: false, reason: 'Access code usage limit reached' };
  if (code.allowed_user && userIdentifier && code.allowed_user !== userIdentifier.toLowerCase()) {
    return { valid: false, reason: 'Access code not valid for this user' };
  }
  return { valid: true };
}

router.post('/', bookingRateLimit, validate(bookingSchema), async (req, res, next) => {
  try {
    const pool = getPool();
    const { name, email, phone, service, date, time, sessionType, message, allowDuplicate, accessCode } = req.body;

    let finalAmount = 0;
    let paymentStatus = 'pending';
    let accessCodeUsed = null;
    let bookingStatus = 'pending';

    if (accessCode) {
      const [rows] = await pool.execute('SELECT * FROM access_codes WHERE code = ?', [accessCode.toUpperCase()]);
      if (rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid access code' });
      }
      const foundAccessCode = rows[0];
      const validation = validateAccessCode(foundAccessCode, email);
      if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.reason });
      }
      finalAmount = 0;
      paymentStatus = 'skipped';
      accessCodeUsed = foundAccessCode.code;
      bookingStatus = 'confirmed';
    }

    if (!allowDuplicate) {
      const [existing] = await pool.execute(
        `SELECT * FROM bookings 
         WHERE (email = ? OR phone = ?) 
         AND booking_date >= CURDATE() 
         AND status NOT IN ('cancelled', 'completed')
         AND payment_status != 'failed'
         ORDER BY booking_date ASC, time ASC LIMIT 1`,
        [email, phone]
      );
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'existing_booking',
          existingBooking: {
            bookingNumber: existing[0].booking_number,
            date: existing[0].booking_date,
            time: existing[0].time,
            service: existing[0].service
          }
        });
      }
    }

    const [slotBooked] = await pool.execute(
      `SELECT id FROM bookings 
       WHERE booking_date = ? AND time = ? 
       AND status != 'cancelled' 
       AND payment_status != 'failed' LIMIT 1`,
      [date, time]
    );
    if (slotBooked.length > 0) {
      return res.status(400).json({ success: false, message: 'This time slot is already booked. Please choose a different time.' });
    }

    const bookingNumber = generateBookingNumber();
    const servicePrice = await getServicePrice(service);

    const [result] = await pool.execute(
      `INSERT INTO bookings (booking_number, name, email, phone, service, booking_date, time, session_type, message, status, payment_status, final_amount, access_code_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingNumber, name, email, phone, service, date, time, sessionType, message || null, bookingStatus, paymentStatus, accessCode ? 0 : servicePrice, accessCodeUsed]
    );

    if (!accessCode) {
      return res.status(201).json({
        success: true,
        message: 'Booking created, payment required',
        requiresPayment: true,
        data: {
          id: result.insertId,
          bookingNumber,
          name,
          service,
          date,
          time,
          sessionType,
          status: bookingStatus,
          amount: servicePrice
        }
      });
    }

    if (accessCode) {
      await pool.execute('UPDATE access_codes SET used_count = used_count + 1 WHERE code = ?', [accessCode.toUpperCase()]);
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        id: result.insertId,
        bookingNumber,
        name,
        service,
        date,
        time,
        sessionType,
        status: bookingStatus
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticateAdmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const { page = 1, limit = 10, status, service, date } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND status = ?'; params.push(status); }
    if (service) { where += ' AND service = ?'; params.push(service); }
    if (date) { where += ' AND booking_date = ?'; params.push(date); }

    const [bookings] = await pool.execute(
      `SELECT * FROM bookings ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM bookings ${where}`,
      params
    );
    const total = countResult[0].total;

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/available-slots/:date', async (req, res, next) => {
  try {
    const pool = getPool();
    const { date } = req.params;
    const requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const [bookedSlots] = await pool.execute(
      `SELECT time FROM bookings WHERE booking_date = ? AND status != 'cancelled' AND payment_status != 'failed'`,
      [date]
    );
    const bookedTimes = bookedSlots.map(b => b.time);
    const allSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'];
    let availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));

    const today = new Date();
    if (requestedDate.toDateString() === today.toDateString()) {
      const now = today.getHours() * 60 + today.getMinutes();
      availableSlots = availableSlots.filter(slot => {
        const [time, period] = slot.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return (h * 60 + m) > now;
      });
    }

    res.json({ success: true, data: { date: requestedDate, availableSlots, bookedSlots: bookedTimes } });
  } catch (error) {
    next(error);
  }
});

router.get('/lookup', async (req, res, next) => {
  try {
    const pool = getPool();
    const { bookingNumber, email } = req.query;
    if (!bookingNumber && !email) {
      return res.status(400).json({ success: false, message: 'Please provide booking number or email' });
    }

    let where = 'WHERE 1=1';
    const params = [];
    if (bookingNumber) { where += ' AND booking_number = ?'; params.push(bookingNumber); }
    if (email) { where += ' AND email = ?'; params.push(email); }

    const [bookings] = await pool.execute(`SELECT * FROM bookings ${where} ORDER BY created_at DESC`, params);
    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
});

router.put('/reschedule/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const { date, time } = req.body;
    if (!date || !time) {
      return res.status(400).json({ success: false, message: 'Date and time are required' });
    }

    const [rows] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const booking = rows[0];

    const bookingDateTime = new Date(booking.booking_date);
    const [timeStr, period] = booking.time.split(' ');
    const [hours, minutes] = timeStr.split(':').map(Number);
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;
    bookingDateTime.setHours(hour24, minutes, 0, 0);

    const now = new Date();
    const hoursDiff = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 12) {
      return res.status(400).json({ success: false, message: 'Bookings can only be rescheduled at least 12 hours in advance' });
    }

    const [existing] = await pool.execute(
      `SELECT id FROM bookings WHERE booking_date = ? AND time = ? AND status != 'cancelled' AND id != ? LIMIT 1`,
      [date, time, req.params.id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'This time slot is already booked. Please choose a different time.' });
    }

    await pool.execute('UPDATE bookings SET booking_date = ?, time = ? WHERE id = ?', [date, time, req.params.id]);
    const [updated] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [req.params.id]);

    res.status(200).json({ success: true, message: 'Booking rescheduled successfully', data: updated[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/cancel-all', authenticateAdmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const [result] = await pool.execute(
      `UPDATE bookings SET status = 'cancelled' WHERE status NOT IN ('cancelled', 'completed') AND booking_date >= CURDATE()`
    );
    res.status(200).json({
      success: true,
      message: `${result.affectedRows} bookings cancelled successfully`,
      data: { cancelledCount: result.affectedRows }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/delete-cancelled', authenticateAdmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const [result] = await pool.execute(`DELETE FROM bookings WHERE status = 'cancelled'`);
    res.status(200).json({
      success: true,
      message: `${result.affectedRows} cancelled bookings deleted permanently`,
      data: { deletedCount: result.affectedRows }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const { status, name, email, phone, service, date, time, sessionType, message } = req.body;

    if (status && Object.keys(req.body).length === 1) {
      if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      const [result] = await pool.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }
      const [updated] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
      try {
        const { sendStatusUpdate } = await import('../utils/whatsappService.js');
        await sendStatusUpdate(updated[0], status);
      } catch (whatsappError) {}
      return res.status(200).json({ success: true, message: 'Booking updated successfully', data: updated[0] });
    }

    const updates = [];
    const params = [];
    if (name) { updates.push('name = ?'); params.push(name); }
    if (email) { updates.push('email = ?'); params.push(email); }
    if (phone) { updates.push('phone = ?'); params.push(phone); }
    if (service) { updates.push('service = ?'); params.push(service); }
    if (date) { updates.push('booking_date = ?'); params.push(date); }
    if (time) { updates.push('time = ?'); params.push(time); }
    if (sessionType) { updates.push('session_type = ?'); params.push(sessionType); }
    if (message !== undefined) { updates.push('message = ?'); params.push(message); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(req.params.id);
    await pool.execute(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`, params);
    const [updated] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [req.params.id]);

    if (updated.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.status(200).json({ success: true, message: 'Booking updated successfully', data: updated[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const [result] = await pool.execute('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.status(200).json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router
