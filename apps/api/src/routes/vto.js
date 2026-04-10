const express = require('express')
const { Buffer } = require('buffer')
const mongoose = require('mongoose')
const { requireAuth } = require('../middleware/auth')
const Item = require('../models/Item')
const Outfit = require('../models/Outfit')
const { createVtoKey, fetchRemoteBuffer, uploadBuffer } = require('../lib/r2')
const { getPrimaryImage } = require('../lib/itemPresentation')

const router = express.Router()
const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'

function resolveGarmentCategory(category = '') {
  const normalized = String(category).toLowerCase()
  if (
    normalized.includes('pantal') ||
    normalized.includes('bottom') ||
    normalized.includes('suk') ||
    normalized.includes('skirt') ||
    normalized.includes('short')
  ) {
    return 'bottoms'
  }

  if (normalized.includes('halj') || normalized.includes('dress')) {
    return 'dresses'
  }

  return 'tops'
}

async function readErrorBody(response) {
  try {
    const body = await response.json()
    return body.detail || body.error || JSON.stringify(body)
  } catch {
    return response.text()
  }
}

router.post('/try-on', requireAuth, async (req, res) => {
  try {
    const itemId = String(req.body.itemId || '')
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'Valid itemId is required' })
    }

    if (!req.dbUser.bodyScanUrl) {
      return res.status(400).json({ error: 'Body scan is required before VTO' })
    }

    const item = await Item.findOne({
      _id: itemId,
      userId: req.dbUser._id,
      isDeleted: false,
    }).lean()

    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.isDigitized || !item.imageClean) {
      return res.status(400).json({ error: 'Only digitized items can be used in Virtual Try-On' })
    }

    const response = await fetch(`${AI_SERVER_URL}/virtual-try-on`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personImageUrl: req.dbUser.bodyScanUrl,
        garmentImageUrl: item.imageClean,
        garmentCategory: resolveGarmentCategory(item.category),
      }),
    })

    if (!response.ok) {
      const message = await readErrorBody(response)
      return res.status(502).json({ error: message || 'AI VTO failed' })
    }

    const payload = await response.json()
    const remoteImageUrl = payload.imageUrl || ''
    const remoteImage = remoteImageUrl
      ? await fetchRemoteBuffer(remoteImageUrl)
      : {
          buffer: Buffer.from(String(payload.imageBase64 || ''), 'base64'),
          contentType: 'image/png',
        }
    const uploadResult = await uploadBuffer({
      key: createVtoKey(req.dbUser._id, itemId),
      buffer: remoteImage.buffer,
      contentType: remoteImage.contentType || 'image/png',
    })

    res.json({
      ok: true,
      data: {
        itemId,
        vtoImageUrl: uploadResult.url,
        sourceImageUrl: remoteImageUrl,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/outfits', requireAuth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const vtoImageUrl = String(req.body.vtoImageUrl || '').trim()
    const itemIds = Array.isArray(req.body.itemIds) ? req.body.itemIds.map(String) : []

    if (!name) {
      return res.status(400).json({ error: 'name is required' })
    }
    if (!vtoImageUrl) {
      return res.status(400).json({ error: 'vtoImageUrl is required' })
    }
    if (itemIds.length !== 1 || itemIds.some((itemId) => !mongoose.Types.ObjectId.isValid(itemId))) {
      return res.status(400).json({ error: 'v1 outfits require exactly one valid itemId' })
    }

    const ownedItems = await Item.find({
      _id: { $in: itemIds },
      userId: req.dbUser._id,
      isDeleted: false,
    })
      .select('_id')
      .lean()

    if (ownedItems.length !== itemIds.length) {
      return res.status(403).json({ error: 'All outfit items must belong to the current user' })
    }

    const outfit = await Outfit.create({
      userId: req.dbUser._id,
      name: name.slice(0, 120),
      itemIds,
      vtoImageUrl,
    })

    res.status(201).json({ ok: true, data: outfit })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/outfits', requireAuth, async (req, res) => {
  try {
    const outfits = await Outfit.find({ userId: req.dbUser._id })
      .sort({ createdAt: -1 })
      .populate('itemIds', 'title images imageClean brand category')
      .lean()

    res.json({
      ok: true,
      data: outfits.map((outfit) => ({
        ...outfit,
        itemIds: (outfit.itemIds || []).map((item) => ({
          ...item,
          primaryImage: getPrimaryImage(item),
        })),
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
