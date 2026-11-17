// Converts MySQL snake_case rows to the camelCase shape expected by the React app.
// Kept as a response-only compatibility layer so database queries stay unchanged.

const camelKey = (key) => key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase())

const serializeValue = (value) => {
  if (Array.isArray(value)) return value.map(serializeValue)
  if (value === null || value === undefined) return value
  if (value instanceof Date || Buffer.isBuffer(value)) return value

  if (typeof value === 'object') {
    const result = {}
    for (const [key, item] of Object.entries(value)) {
      result[camelKey(key)] = serializeValue(item)
    }

    // Several frontend screens still use the old MongoDB-style `_id` field.
    if (result.id !== undefined && result._id === undefined) {
      result._id = result.id
    }

    // MySQL stores the booking date as `booking_date`; the UI reads `date`.
    if (result.bookingDate !== undefined && result.date === undefined) {
      result.date = result.bookingDate
    }

    return result
  }

  return value
}

export const serializeResponse = (body) => serializeValue(body)

export default serializeResponse
