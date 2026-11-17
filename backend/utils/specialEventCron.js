import { getPool } from '../config/database.js';

export const resetExpiredSpecialEvents = async () => {
  try {
    const pool = getPool();
    const [expired] = await pool.execute(
      `SELECT * FROM service_pricings WHERE special_event IS NOT NULL AND valid_until <= NOW()`
    );

    if (expired.length === 0) return;

    for (const service of expired) {
      const newPrice = service.original_price || service.price;
      await pool.execute(
        'UPDATE service_pricings SET price = ?, original_price = NULL, special_event = NULL, valid_until = NULL WHERE id = ?',
        [newPrice, service.id]
      );
      console.log(`✅ Reset expired special event for ${service.name}`);
    }

    console.log(`🔄 Reset ${expired.length} expired special events`);
  } catch (error) {
    console.error('❌ Error resetting expired special events:', error);
  }
};

export const startSpecialEventCron = () => {
  resetExpiredSpecialEvents();
  setInterval(resetExpiredSpecialEvents, 5 * 60 * 1000);
  console.log('⏰ Special event cron job started (runs every 5 minutes)');
};
