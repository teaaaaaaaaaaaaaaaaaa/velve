const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Item = require('../models/Item')

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'

// Fire-and-forget: generate CLIP embedding for first image and save to DB
function generateEmbeddingAsync(itemId, imageUrl) {
  fetch(`${AI_SERVER_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.embedding) {
        Item.findByIdAndUpdate(itemId, { embedding: data.embedding }).exec()
      }
    })
    .catch((err) => console.error(`Embedding failed for item ${itemId}:`, err.message))
}

// GET /api/items — lista itema sa cursor paginacijom
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const query = {}

    // Cursor-based pagination: items older than cursor
    if (req.query.cursor) {
      if (!mongoose.Types.ObjectId.isValid(req.query.cursor)) {
        return res.status(400).json({ error: 'Invalid cursor' })
      }
      query._id = { $lt: req.query.cursor }
    }

    // Optional category filter
    if (req.query.category) {
      query.category = req.query.category
    }

    const items = await Item.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('userId', 'displayName photoURL')
      .lean()

    const hasMore = items.length > limit
    if (hasMore) items.pop()

    const nextCursor = items.length > 0 ? items[items.length - 1]._id : null

    res.json({ ok: true, data: items, nextCursor, hasMore })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/items/:id — detalji jednog itema
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id)
      .populate('userId', 'displayName photoURL')
      .lean()

    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    res.json({ ok: true, data: item })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/items — kreiranje novog itema (zahteva auth)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, category, brand, size, condition, images } = req.body

    if (!title || !category || !condition) {
      return res.status(400).json({ error: 'title, category, and condition are required' })
    }

    const validConditions = ['new', 'like_new', 'good', 'fair']
    if (!validConditions.includes(condition)) {
      return res.status(400).json({ error: `condition must be one of: ${validConditions.join(', ')}` })
    }

    const item = await Item.create({
      userId: req.dbUser._id,
      title: title.slice(0, 100),
      description: (description || '').slice(0, 500),
      category,
      brand: brand || '',
      size: size || '',
      condition,
      images: images || [],
    })

    // Generate CLIP embedding in background (non-blocking)
    if (item.images.length > 0) {
      generateEmbeddingAsync(item._id, item.images[0])
    }

    res.status(201).json({ ok: true, data: item })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/items/:id/similar — vizuelno slični itemi (FAISS)
router.get('/:id/similar', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id).lean()
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.embedding || item.embedding.length === 0) {
      return res.json({ ok: true, data: [] })
    }

    const topK = Math.min(parseInt(req.query.limit) || 10, 30)
    const response = await fetch(`${AI_SERVER_URL}/similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embedding: item.embedding, top_k: topK, exclude_id: req.params.id }),
    })
    const result = await response.json()

    const similarIds = (result.results || []).map((r) => r.item_id)
    const similarItems = await Item.find({ _id: { $in: similarIds } })
      .populate('userId', 'displayName photoURL')
      .lean()

    res.json({ ok: true, data: similarItems })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/items/:id — izmena itema (samo vlasnik)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.userId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Not authorized to edit this item' })
    }

    const allowed = ['title', 'description', 'category', 'brand', 'size', 'condition', 'images']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key]
      }
    }

    // Enforce length limits
    if (updates.title) updates.title = updates.title.slice(0, 100)
    if (updates.description) updates.description = updates.description.slice(0, 500)

    if (updates.condition) {
      const validConditions = ['new', 'like_new', 'good', 'fair']
      if (!validConditions.includes(updates.condition)) {
        return res.status(400).json({ error: `condition must be one of: ${validConditions.join(', ')}` })
      }
    }

    const updated = await Item.findByIdAndUpdate(req.params.id, updates, { new: true })
    res.json({ ok: true, data: updated })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/items/:id — brisanje itema (samo vlasnik)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.userId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Not authorized to delete this item' })
    }

    await Item.findByIdAndDelete(req.params.id)
    res.json({ ok: true, message: 'Item deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
