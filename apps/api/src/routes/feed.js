const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')

// GET /api/feed — personalizovani feed (zahteva auth)
router.get('/', requireAuth, (req, res) => {
  res.json({ ok: true, data: [] })
})

module.exports = router
