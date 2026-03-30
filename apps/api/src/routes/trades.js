const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')

// GET /api/trades — lista trade requestova korisnika
router.get('/', requireAuth, (req, res) => {
  res.json({ ok: true, data: [] })
})

// POST /api/trades — slanje trade requesta
router.post('/', requireAuth, (req, res) => {
  res.json({ ok: true, message: 'Trade request sent' })
})

// PUT /api/trades/:id — prihvatanje ili odbijanje trade requesta
router.put('/:id', requireAuth, (req, res) => {
  res.json({ ok: true, message: 'Trade request updated' })
})

module.exports = router
