const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')

// GET /api/chat — lista chat soba korisnika
router.get('/', requireAuth, (req, res) => {
  res.json({ ok: true, data: [] })
})

// GET /api/chat/:id — poruke u chat sobi
router.get('/:id', requireAuth, (req, res) => {
  res.json({ ok: true, data: [] })
})

// POST /api/chat/:id/message — slanje poruke
router.post('/:id/message', requireAuth, (req, res) => {
  res.json({ ok: true, message: 'Message sent' })
})

module.exports = router
