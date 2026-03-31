const express = require('express')
const crypto = require('crypto')
const path = require('path')
const multer = require('multer')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { requireAuth } = require('../middleware/auth')
const { uploadLimiter } = require('../middleware/rateLimit')

const router = express.Router()

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

    res.json({ ok: true, url: publicUrl })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
