const express = require('express')
const { requireAuth } = require('../middleware/auth')
const { uploadLimiter } = require('../middleware/rateLimit')
const { imageUpload } = require('../lib/uploadMiddleware')
const { createUserUploadKey, deleteObject, uploadBuffer } = require('../lib/r2')
const { validateAndNormalizeImage } = require('../lib/uploadSecurity')

const router = express.Router()

async function moderateImage(imageUrl) {
  if (!process.env.SIGHTENGINE_USER || !process.env.SIGHTENGINE_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      return { safe: false, details: 'Image moderation is not configured' }
    }
    console.log('[Moderation] Skipping in development - no Sightengine credentials configured')
    return { safe: true, details: 'skipped_development' }
  }

  try {
    const response = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        url: imageUrl,
        models: 'nudity,wad,offensive',
        api_user: process.env.SIGHTENGINE_USER,
        api_secret: process.env.SIGHTENGINE_SECRET,
      }),
    })

    const data = await response.json()
    const nudityScore = data.nudity?.raw || 0
    const weaponScore = data.weapon || 0
    const offensiveScore = data.offensive?.prob || 0
    const isSafe = nudityScore < 0.7 && weaponScore < 0.8 && offensiveScore < 0.8

    return { safe: isSafe, details: data }
  } catch (err) {
    console.error('[Moderation] Failed:', err.message)
    if (process.env.NODE_ENV === 'production') {
      return { safe: false, details: 'Image moderation unavailable' }
    }
    return { safe: true, details: 'moderation_failed_development' }
  }
}

router.post('/', uploadLimiter, requireAuth, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    const normalizedImage = await validateAndNormalizeImage(req.file, { forceJpeg: true })
    const key = createUserUploadKey(req.dbUser._id, `upload.${normalizedImage.extension}`)
    const uploadResult = await uploadBuffer({
      key,
      buffer: normalizedImage.buffer,
      contentType: normalizedImage.contentType,
    })

    const moderation = await moderateImage(uploadResult.url)
    if (!moderation.safe) {
      await deleteObject(key)
      return res.status(400).json({
        error: 'Image flagged by moderation system',
        details: process.env.NODE_ENV === 'development' ? moderation.details : undefined,
      })
    }

    res.json({ ok: true, data: { key, url: uploadResult.url } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
