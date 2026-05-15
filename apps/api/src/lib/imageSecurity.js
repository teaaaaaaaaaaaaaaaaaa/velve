const { keyFromUrl, normalizePublicBaseUrl } = require('./r2')

function getR2ObjectKeyFromPublicUrl(url = '') {
  const publicBase = normalizePublicBaseUrl()
  const value = String(url || '').trim()

  if (!publicBase) {
    const err = new Error('R2_PUBLIC_URL is not configured')
    err.statusCode = 500
    throw err
  }

  if (!value.startsWith(`${publicBase}/`)) {
    const err = new Error('Image URL must be a Velve upload')
    err.statusCode = 400
    throw err
  }

  const key = keyFromUrl(value)
  if (!key || key.includes('..') || key.startsWith('/')) {
    const err = new Error('Invalid image URL')
    err.statusCode = 400
    throw err
  }

  return key
}

function assertR2PublicUrlWithPrefix(url, prefix, message = 'Image URL is not allowed') {
  const key = getR2ObjectKeyFromPublicUrl(url)
  const normalizedPrefix = String(prefix || '').replace(/^\/+/, '').replace(/\/+$/, '')

  if (!normalizedPrefix || !key.startsWith(`${normalizedPrefix}/`)) {
    const err = new Error(message)
    err.statusCode = 400
    throw err
  }

  return key
}

function filterOwnedItemImageUrls(urls = [], userId) {
  const imageUrls = Array.isArray(urls) ? urls.filter((url) => typeof url === 'string').slice(0, 5) : []
  for (const imageUrl of imageUrls) {
    assertR2PublicUrlWithPrefix(
      imageUrl,
      `items/${userId}`,
      'Item images must be uploaded by the current user'
    )
  }
  return imageUrls
}

module.exports = {
  assertR2PublicUrlWithPrefix,
  filterOwnedItemImageUrls,
  getR2ObjectKeyFromPublicUrl,
}
