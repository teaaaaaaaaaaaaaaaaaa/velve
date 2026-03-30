const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')

// GET /api/items — lista svih itema (feed)
router.get('/', (req, res) => {
  res.json({ ok: true, data: [] })
})

// GET /api/items/:id — detalji itema
router.get('/:id', (req, res) => {
  res.json({ ok: true, data: null })
})

// POST /api/items — kreiranje novog itema (zahteva auth)
router.post('/', requireAuth, (req, res) => {
  res.json({ ok: true, message: 'Item created' })
})

// PUT /api/items/:id — izmena itema (zahteva auth)
router.put('/:id', requireAuth, (req, res) => {
  res.json({ ok: true, message: 'Item updated' })
})

// DELETE /api/items/:id — brisanje itema (zahteva auth)
router.delete('/:id', requireAuth, (req, res) => {
  res.json({ ok: true, message: 'Item deleted' })
})

module.exports = router
