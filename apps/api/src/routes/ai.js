const express = require('express')
const { requireAuth } = require('../middleware/auth')
const { imageUpload } = require('../lib/uploadMiddleware')
const { getInternalAiHeaders } = require('../lib/aiClient')
const { validateAndNormalizeImage } = require('../lib/uploadSecurity')
const { assertR2PublicUrlWithPrefix } = require('../lib/imageSecurity')
const Item = require('../models/Item')

// The user may pass either a raw upload (items/<userId>/...) or a Clean Cut
// asset (items/<itemId>/clean_*.png). The clean key is scoped by item id, not
// user id, so a prefix check alone rejects it — fall back to verifying the URL
// belongs to an item owned by this user.
async function isOwnedImageUrl(imageUrl, userId) {
  try {
    assertR2PublicUrlWithPrefix(imageUrl, `items/${userId}`)
    return true
  } catch {
    const ownedItem = await Item.findOne({
      userId,
      $or: [{ imageClean: imageUrl }, { images: imageUrl }],
    })
      .select('_id')
      .lean()
    return Boolean(ownedItem)
  }
}

const router = express.Router()

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'

async function forwardImageToAi(endpoint, file) {
  if (!file) {
    throw new Error('Image file is required')
  }

  const normalizedImage = await validateAndNormalizeImage(file, { forceJpeg: true })
  const formData = new FormData()
  formData.append(
    'file',
    new Blob([normalizedImage.buffer], { type: normalizedImage.contentType }),
    `image.${normalizedImage.extension}`
  )

  const response = await fetch(`${AI_SERVER_URL}${endpoint}`, {
    method: 'POST',
    headers: getInternalAiHeaders(),
    body: formData,
  })

  if (!response.ok) {
    let message = 'AI server error'
    try {
      const errorBody = await response.json()
      message = errorBody.detail || errorBody.error || message
    } catch {
      message = await response.text()
    }
    throw new Error(message)
  }

  return response.json()
}

router.post('/generate-description', requireAuth, async (req, res) => {
  try {
    const { category, size, brand, condition, color, language, image_url } = req.body

    if (!category) {
      return res.status(400).json({ error: 'category is required' })
    }
    if (image_url) {
      const allowed = await isOwnedImageUrl(image_url, req.dbUser._id)
      if (!allowed) {
        return res
          .status(400)
          .json({ error: 'image_url must be an image uploaded by the current user' })
      }
    }

    const response = await fetch(`${AI_SERVER_URL}/generate-description`, {
      method: 'POST',
      headers: getInternalAiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ category, size, brand, condition, color, language: language || 'sr', image_url: image_url || '' }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.detail || 'AI server error' })
    }

    const data = await response.json()
    res.json({ ok: true, data })
  } catch (err) {
    res.status(502).json({ error: `AI server unavailable: ${err.message}` })
  }
})

router.post(
  '/analyze-garment-photo',
  requireAuth,
  imageUpload.single('image'),
  async (req, res) => {
    try {
      const data = await forwardImageToAi('/analyze-garment-photo', req.file)
      console.log('[analyze-garment-photo]', JSON.stringify({
        ready: data?.ready,
        checks: data?.checks,
        metrics: data?.metrics,
      }))
      res.json({ ok: true, data })
    } catch (err) {
      res.status(502).json({ error: `AI server unavailable: ${err.message}` })
    }
  }
)

router.post(
  '/analyze-body-scan',
  requireAuth,
  imageUpload.single('image'),
  async (req, res) => {
    try {
      const data = await forwardImageToAi('/analyze-body-scan', req.file)
      res.json({ ok: true, data })
    } catch (err) {
      res.status(502).json({ error: `AI server unavailable: ${err.message}` })
    }
  }
)

module.exports = router
