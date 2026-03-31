/**
 * Strip MongoDB query operators from user input to prevent injection.
 * Converts objects/arrays to strings, strips keys starting with $.
 */
function sanitizeInput(value) {
  if (value === null || value === undefined) return value
  if (typeof value === 'object') return String(value)
  return value
}

/**
 * Sanitize all string values in an object (shallow).
 */
function sanitizeQuery(obj) {
  const clean = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue
    clean[key] = sanitizeInput(value)
  }
  return clean
}

module.exports = { sanitizeInput, sanitizeQuery }
