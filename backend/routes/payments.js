import express from 'express'
import Razorpay from 'razorpay'
import crypto from 'crypto'
import { body, validationResult } from 'express-validator'
import rateLimit from 'express-rate-limit'
import { getPool } from '../config/database.js'
import { getServicePrice } from '../utils/pricing.js'

const router = express.Router()

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many payment attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
})

const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured')
  }
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
}

const validateCreateOrder = [
  body('service').notEmpty().withMessage('Service is required').custom(async (value) => {
    const validServices = ['tarot', 'reiki', 'water-divination', 'spiritual-consultation'];
    if (!validServices.includes(value)) throw new Error('Invalid service selected');
    return true;
  }),
  body('bookingId').optional().isInt().withMessage('Invalid booking ID format'),
  body('customerDetails').optional().isObject().withMessage('Customer details must be an object'),
  body('customerDetails.name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('customerDetails.email').optional().isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('customerDetails.phone').optional().matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian phone number')
]

const validateVerifyPayment = [
  body('razorpay_order_id').notEmpty().withMessage('Order ID is required'),
  body('razorpay_payment_id').notEmpty().withMessage('Payment ID is required'),
  body('razorpay_signature').notEmpty().withMessage('Signature is required'),
  body('bookingId').optional().isInt().withMessage('Invalid booking ID format')
]

router.post('/create-order', paymentLimiter, validateCreateOrder, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const pool = getPool();
    const { service, bookingId, customerDetails } = req.body;
    const amount = await getServicePrice(service);

    if (bookingId) {
      const [rows] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      if (rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (rows[0].payment_status === 'completed') return res.status(400).json({ success: false, message: 'Payment already completed for this booking' });
      await pool.execute('UPDATE bookings SET payment_status = ? WHERE id = ?', ['pending', bookingId]);
    }

    try {
      const razorpay = getRazorpayInstance();
      const options = {
        amount,
        currency: 'INR',
        receipt: `receipt_${bookingId || Date.now()}`,
        notes: { service, bookingId: bookingId || '', serviceName: service.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }
      };
      const order = await razorpay.orders.create(options);
      res.status(200).json({
        success: true,
        data: { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, prefill: customerDetails || {}, notes: options.notes }
      });
    } catch (razorpayError) {
      console.error('❌ Razorpay order creation failed:', {
        status: razorpayError.statusCode,
        code: razorpayError.error?.code,
        description: razorpayError.error?.description || razorpayError.message
      });
      if (razorpayError.statusCode === 401) {
        console.error('⚠️ Razorpay authentication failed: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must belong to the same account and the same test/live mode.');
      }
      if (bookingId) await pool.execute('UPDATE bookings SET payment_status = ? WHERE id = ?', ['failed', bookingId]);
      const isAuthError = razorpayError.statusCode === 401 || razorpayError.error?.code === 'BAD_REQUEST_ERROR';
      return res.status(500).json({
        success: false,
        message: isAuthError
          ? 'Payment gateway is not configured correctly. Please contact us to complete your booking.'
          : 'Unable to create payment order. Please try again.',
        ...(process.env.NODE_ENV === 'development' && { details: razorpayError.error?.description || razorpayError.message })
      });
    }
  } catch (error) {
    next(error);
  }
})

router.post('/verify', paymentLimiter, validateVerifyPayment, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const pool = getPool();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body.toString()).digest('hex');

    if (expectedSignature !== razorpay_signature) {
      if (bookingId) await pool.execute('UPDATE bookings SET payment_status = ? WHERE id = ?', ['failed', bookingId]);
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    let updatedBooking = null;
    if (bookingId) {
      const [rows] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      if (rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
      const booking = rows[0];
      if (booking.payment_status === 'completed' && booking.payment_id) {
        return res.status(200).json({ success: true, message: 'Payment already verified', data: { paymentId: booking.payment_id, orderId: booking.order_id, bookingId: booking.id } });
      }
      await pool.execute(
        'UPDATE bookings SET payment_status = ?, payment_id = ?, order_id = ?, paid_at = NOW() WHERE id = ?',
        ['completed', razorpay_payment_id, razorpay_order_id, bookingId]
      );
      const [updated] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      updatedBooking = updated[0];

      try {
        const { sendBookingConfirmation } = await import('../utils/whatsappService.js');
        await sendBookingConfirmation(updatedBooking);
      } catch (whatsappError) {}
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: { paymentId: razorpay_payment_id, orderId: razorpay_order_id, bookingId: updatedBooking?.id || null }
    });
  } catch (error) {
    if (req.body.bookingId) {
      try {
        const pool = getPool();
        await pool.execute('UPDATE bookings SET payment_status = ? WHERE id = ?', ['failed', req.body.bookingId]);
      } catch (updateError) {}
    }
    next(error);
  }
})

router.post('/failure', paymentLimiter, async (req, res, next) => {
  try {
    const pool = getPool();
    const { orderId, bookingId, error } = req.body;
    if (bookingId) {
      await pool.execute(
        'UPDATE bookings SET payment_status = ?, order_id = ?, failure_reason = ? WHERE id = ? AND payment_status != ?',
        ['failed', orderId || null, error?.description || 'Payment failed', bookingId, 'completed']
      );
      const [rows] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      if (rows.length > 0) {
        try {
          const { sendPaymentFailure } = await import('../utils/whatsappService.js');
          await sendPaymentFailure(rows[0]);
        } catch (whatsappError) {}
      }
    }
    res.status(200).json({ success: false, message: error?.description || 'Payment failed. Please try again.' });
  } catch (error) {
    next(error);
  }
})

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: 'Webhook not configured' });

  const signature = req.headers['x-razorpay-signature'];
  try {
    // Razorpay signs the exact raw payload. express.raw() gives us a Buffer,
    // so never JSON.stringify it before calculating the HMAC.
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (expectedSignature !== signature) return res.status(400).json({ error: 'Invalid signature' });

    const payload = JSON.parse(rawBody.toString('utf8'));
    const pool = getPool();
    const event = payload.event;
    const paymentEntity = payload.payload.payment.entity;

    switch (event) {
      case 'payment.captured':
        await pool.execute(
          'UPDATE bookings SET payment_status = ?, payment_id = ?, paid_at = NOW() WHERE order_id = ?',
          ['completed', paymentEntity.id, paymentEntity.order_id]
        );
        break;
      case 'payment.failed':
        await pool.execute(
          'UPDATE bookings SET payment_status = ?, failure_reason = ? WHERE order_id = ?',
          ['failed', paymentEntity.error_description, paymentEntity.order_id]
        );
        break;
    }
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
})

router.get('/config', (req, res) => {
  res.json({ success: true, data: { keyId: process.env.RAZORPAY_KEY_ID } });
})

export default router
