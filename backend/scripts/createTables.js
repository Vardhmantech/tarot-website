import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';

const createTables = async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tarot_website',
      charset: 'utf8mb4'
    });

    console.log('📦 Connected to MySQL');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_number VARCHAR(20) UNIQUE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        service VARCHAR(50) NOT NULL,
        booking_date DATE NOT NULL,
        time VARCHAR(20) NOT NULL,
        session_type VARCHAR(20) NOT NULL,
        message TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        payment_status VARCHAR(20) DEFAULT 'pending',
        final_amount INT DEFAULT 0,
        access_code_used VARCHAR(20),
        payment_id VARCHAR(100),
        order_id VARCHAR(100),
        paid_at DATETIME,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_service (service),
        INDEX idx_booking_date (booking_date),
        INDEX idx_email (email),
        INDEX idx_phone (phone),
        INDEX idx_payment_status (payment_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ bookings table created');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_type VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(200) NOT NULL,
        short_description TEXT NOT NULL,
        full_description TEXT NOT NULL,
        features JSON,
        image_url VARCHAR(500) DEFAULT '',
        duration VARCHAR(50) DEFAULT '45-60 minutes',
        is_active BOOLEAN DEFAULT TRUE,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ services table created');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS contents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        section_id VARCHAR(100) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'text',
        content JSON NOT NULL,
        content_hindi JSON,
        updated_by VARCHAR(100) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_section_id (section_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ contents table created');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        subject VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ contacts table created');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS access_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        expires_at DATETIME NOT NULL,
        max_uses INT NOT NULL DEFAULT 1,
        used_count INT DEFAULT 0,
        allowed_user VARCHAR(255),
        created_by VARCHAR(100) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ access_codes table created');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS pricings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service VARCHAR(50) UNIQUE NOT NULL,
        base_price INT NOT NULL,
        current_price INT NOT NULL,
        discount INT DEFAULT 0,
        sale_active BOOLEAN DEFAULT FALSE,
        sale_label VARCHAR(200) DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ pricings table created');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS service_pricings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        price INT NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        original_price INT,
        is_active BOOLEAN DEFAULT TRUE,
        special_event VARCHAR(200),
        valid_until DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ service_pricings table created');

    console.log('🎉 All tables created successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Table creation failed:', error.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
};

createTables();
