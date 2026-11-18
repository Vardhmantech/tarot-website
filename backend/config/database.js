import mysql from 'mysql2/promise';

let pool;

const connectDB = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tarot_website',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
      // Shared MySQL hosts close idle sockets; keep them alive so queries do not fail with ECONNRESET.
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 20000,
      maxIdle: 5,
      idleTimeout: 60000,
      // Return DATE columns as `YYYY-MM-DD` instead of timezone-shifted Date objects.
      dateStrings: ['DATE']
    });

    const connection = await pool.getConnection();
    console.log(`🍃 MySQL Connected: ${connection.config.host}`);
    connection.release();

    pool.on('connection', (conn) => {
      conn.on('error', (err) => {
        console.error('❌ MySQL connection error:', err);
      });
    });

  } catch (error) {
    console.error("❌ Database connection error:", error.message);
    process.exit(1);
  }
};

export const getPool = () => {
  if (!pool) throw new Error('Database not connected. Call connectDB first.');
  return pool;
};

export default connectDB;
