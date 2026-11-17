export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (process.env.NODE_ENV === 'development') {
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

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
