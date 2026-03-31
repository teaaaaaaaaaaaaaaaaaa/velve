const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'

// POST /api/ai/generate-description — proxy to AI server
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

module.exports = router
