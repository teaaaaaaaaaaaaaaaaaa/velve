const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const Item = require('../models/Item')
const User = require('../models/User')
const { sanitizeInput } = require('../lib/sanitize')
const { enrichItems } = require('../lib/enrichItems')

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
    const query = { isDeleted: false }

    // Filter by userId — prikazuje sve statuse korisnika (za profil)
    if (req.query.userId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json({ error: 'Invalid userId' })
      }
      query.userId = new mongoose.Types.ObjectId(req.query.userId)
    } else {
      // Za opšti feed — samo dostupni itemi
      query.status = 'available'
    }

    // Cursor-based pagination: items older than cursor
    if (req.query.cursor) {
      if (!mongoose.Types.ObjectId.isValid(req.query.cursor)) {
        return res.status(400).json({ error: 'Invalid cursor' })
      }
      query._id = { $lt: req.query.cursor }
    }

    // Optional category filter (sanitized against NoSQL injection)
    if (req.query.category) {
      query.category = sanitizeInput(req.query.category)
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

    const item = await Item.findOne({ _id: req.params.id, isDeleted: false })
      .populate('userId', 'displayName photoURL')
      .lean()

    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    // Enrich with isLiked, isWishlisted, likesCount (if user is logged in)
    const userId = req.user?.uid
      ? (await User.findOne({ firebaseUid: req.user.uid }))?._id
      : null
    const enriched = await enrichItems(item, userId)

    res.json({ ok: true, data: enriched })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/items — kreiranje novog itema (zahteva auth)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, category, brand, size, condition, images } = req.body

    if (!title || typeof title !== 'string' || !category || typeof category !== 'string' || !condition || typeof condition !== 'string') {
      return res.status(400).json({ error: 'title, category, and condition are required (strings)' })
    }

    const validConditions = ['new', 'like_new', 'good', 'fair']
    if (!validConditions.includes(condition)) {
      return res.status(400).json({ error: `condition must be one of: ${validConditions.join(', ')}` })
    }

    // Validate images array
    const imageList = Array.isArray(images) ? images.filter((u) => typeof u === 'string').slice(0, 5) : []

    const item = await Item.create({
      userId: req.dbUser._id,
      title: String(title).slice(0, 100),
      description: String(description || '').slice(0, 500),
      category: String(category).slice(0, 50),
      brand: String(brand || '').slice(0, 50),
      size: String(size || '').slice(0, 20),
      condition,
      images: imageList,
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
    const similarItems = await Item.find({ _id: { $in: similarIds }, status: 'available', isDeleted: false })
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

    const allowed = { title: 100, description: 500, category: 50, brand: 50, size: 20 }
    const updates = {}
    for (const [key, maxLen] of Object.entries(allowed)) {
      if (req.body[key] !== undefined) {
        updates[key] = String(req.body[key]).slice(0, maxLen)
      }
    }
    if (req.body.images !== undefined) {
      updates.images = Array.isArray(req.body.images)
        ? req.body.images.filter((u) => typeof u === 'string').slice(0, 5)
        : []
    }

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

// DELETE /api/items/:id — soft delete itema (samo vlasnik)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }

    const item = await Item.findOne({ _id: req.params.id, isDeleted: false })
    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.userId.equals(req.dbUser._id)) {
      return res.status(403).json({ error: 'Not authorized to delete this item' })
    }

    // Soft delete: mark as deleted instead of removing from DB
    await Item.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      deletedAt: new Date(),
    })

    res.json({ ok: true, message: 'Item deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
