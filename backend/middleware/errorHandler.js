const DB_TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'ER_CON_COUNT_ERROR',
  'ER_LOCK_WAIT_TIMEOUT',
  'ER_LOCK_DEADLOCK'
]);

export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  const isProduction = process.env.NODE_ENV === 'production';

  if (DB_TRANSIENT_CODES.has(err.code)) {
    console.error('❌ Database temporarily unavailable:', err.code, err.message);
    return res.status(503).json({
      success: false,
      message: 'Service is temporarily unavailable. Please try again in a moment.'
    });
  }

  if (isProduction && !err.statusCode) {
    console.error('❌ Error:', err.code || err.name, err.message);
  } else if (!isProduction) {
    console.error('❌ Error:', err);
  }

  if (err.code === 'ER_DUP_ENTRY') {
    let message = 'Duplicate field value entered';
    if (err.message && err.message.includes('booking_number')) {
      message = 'Booking number already exists';
    }
    error = { message, statusCode: 400 };
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    error = { message: 'Referenced record not found', statusCode: 400 };
  }

  if (err.name === 'JsonWebTokenError') {
    error = { message: 'Invalid token', statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    error = { message: 'Token expired', statusCode: 401 };
  }

  const statusCode = error.statusCode || 500;
  const message =
    statusCode >= 500 && isProduction
      ? 'Server Error'
      : error.message || 'Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(!isProduction && { stack: err.stack })
  });
};
