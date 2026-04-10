const express = require('express')
const { requireAuth } = require('../middleware/auth')
const { imageUpload } = require('../lib/uploadMiddleware')

const router = express.Router()

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'

async function forwardImageToAi(endpoint, file) {
  if (!file) {
    throw new Error('Image file is required')
  }

  const formData = new FormData()
  formData.append(
    'file',
    new Blob([file.buffer], { type: file.mimetype }),
    file.originalname || 'image.jpg'
  )

  const response = await fetch(`${AI_SERVER_URL}${endpoint}`, {
    method: 'POST',
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
    const { category, size, brand, condition, color, language } = req.body

    if (!category) {
      return res.status(400).json({ error: 'category is required' })
    }

    const response = await fetch(`${AI_SERVER_URL}/generate-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, size, brand, condition, color, language: language || 'en' }),
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
