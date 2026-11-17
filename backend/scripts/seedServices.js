import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';

const seedServices = async () => {
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

    await conn.execute('DELETE FROM services');
    console.log('🗑️  Cleared existing services');

    const services = [
      {
        serviceType: 'tarot',
        title: 'Tarot Reading',
        shortDescription: "Gain clarity and insight into your life's questions through the ancient wisdom of tarot cards",
        fullDescription: 'Experience profound insights through personalized tarot readings. Our experienced readers connect with your energy to provide guidance on love, career, spirituality, and life decisions.',
        features: JSON.stringify(['Personalized card interpretation', 'Guidance on life decisions', 'Clarity on relationships and career', 'Spiritual insights and direction']),
        duration: '45-60 minutes',
        displayOrder: 1,
        isActive: true
      },
      {
        serviceType: 'reiki',
        title: 'Reiki Healing',
        shortDescription: 'Experience deep relaxation and energy healing through the gentle power of Reiki',
        fullDescription: 'Reiki is a Japanese healing technique that promotes relaxation, reduces stress, and facilitates healing by channeling universal life energy. Experience balance and harmony in body, mind, and spirit.',
        features: JSON.stringify(['Energy balancing and alignment', 'Stress and anxiety relief', 'Physical and emotional healing', 'Chakra cleansing and activation']),
        duration: '60 minutes',
        displayOrder: 2,
        isActive: true
      },
      {
        serviceType: 'water-divination',
        title: 'Water Divination',
        shortDescription: 'Discover hidden truths and receive divine messages through the sacred practice of water scrying',
        fullDescription: 'Water divination is an ancient mystical practice that uses water as a medium to receive spiritual messages and insights. Through focused meditation and intuitive connection, receive guidance from the spiritual realm.',
        features: JSON.stringify(['Ancient divination technique', 'Spiritual message channeling', 'Deep intuitive insights', 'Connection with higher consciousness']),
        duration: '45 minutes',
        displayOrder: 3,
        isActive: true
      }
    ];

    for (const s of services) {
      await conn.execute(
        'INSERT INTO services (service_type, title, short_description, full_description, features, duration, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [s.serviceType, s.title, s.shortDescription, s.fullDescription, s.features, s.duration, s.displayOrder, s.isActive]
      );
    }

    console.log('✅ Services seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
};

seedServices();
