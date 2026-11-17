import { getPool } from '../config/database.js'

// Razorpay expects amounts in paise. The admin UI stores rupees in service_pricings.
const FALLBACK_AMOUNTS = {
  tarot: 110000,
  reiki: 155100,
  'water-divination': 2100000,
  'spiritual-consultation': 250000
}

export const getServicePrice = async (service) => {
  const pool = getPool()

  const [current] = await pool.execute(
    'SELECT price FROM service_pricings WHERE service_id = ? AND is_active = TRUE LIMIT 1',
    [service]
  )
  if (current.length > 0 && Number(current[0].price) > 0) {
    return Math.round(Number(current[0].price) * 100)
  }

  // Legacy table retained as a fallback for older installations.
  const [legacy] = await pool.execute(
    'SELECT current_price FROM pricings WHERE service = ? LIMIT 1',
    [service]
  )
  if (legacy.length > 0 && Number(legacy[0].current_price) > 0) {
    return Number(legacy[0].current_price)
  }

  return FALLBACK_AMOUNTS[service] || 0
}

export default getServicePrice
