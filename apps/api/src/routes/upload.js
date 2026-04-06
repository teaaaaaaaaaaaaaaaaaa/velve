const express = require('express')
const crypto = require('crypto')
const path = require('path')
const multer = require('multer')
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { requireAuth } = require('../middleware/auth')
const { uploadLimiter } = require('../middleware/rateLimit')

const router = express.Router()

// Image moderation via Sightengine (optional - requires API key)
async function moderateImage(imageUrl) {
  // Skip moderation if no API credentials configured
  if (!process.env.SIGHTENGINE_USER || !process.env.SIGHTENGINE_SECRET) {
    console.log('[Moderation] Skipping - no Sightengine credentials configured')
    return { safe: true, details: null }
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

    // Define safety thresholds
    const nudityScore = data.nudity?.raw || 0
    const weaponScore = data.weapon || 0
    const offensiveScore = data.offensive?.prob || 0

    const isSafe = nudityScore < 0.7 && weaponScore < 0.8 && offensiveScore < 0.8

    return { safe: isSafe, details: data }
  } catch (err) {
    console.error('[Moderation] Failed:', err.message)
    // On error, allow the image (fail-open to avoid blocking legitimate uploads)
    return { safe: true, details: null }
  }
}

// Multer: store in memory, max 5MB, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'))
    }
  },
})

// S3-compatible client for Cloudflare R2
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
})

// POST /api/upload — upload image to Cloudflare R2
router.post('/', uploadLimiter, requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    const ext = path.extname(req.file.originalname) || '.jpg'
    const filename = `items/${req.dbUser._id}/${crypto.randomUUID()}${ext}`

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: filename,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    )

    // R2 public URL: endpoint without the S3 API path + bucket + key
    // Format: https://<custom-domain>/<key> or https://pub-<hash>.r2.dev/<key>
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${filename}`

    // Moderate image content (optional - requires Sightengine credentials)
    const moderation = await moderateImage(publicUrl)

    if (!moderation.safe) {
      // Delete flagged image from R2
      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: filename,
        })
      )

      return res.status(400).json({
        error: 'Image flagged by moderation system',
        details: process.env.NODE_ENV === 'development' ? moderation.details : undefined,
      })
    }

    res.json({ ok: true, data: { url: publicUrl } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
