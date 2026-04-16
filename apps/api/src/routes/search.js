const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { maybeAuth } = require('../middleware/auth')
const Item = require('../models/Item')
const { enrichItems } = require('../lib/enrichItems')
const { withPrimaryImage } = require('../lib/itemPresentation')
const { getBlockedUserIds, getHiddenItemIds } = require('../lib/discovery')
const { textSearch, pingAiServer } = require('../lib/aiClient')

const MIN_QUERY_LEN = 2
const MAX_QUERY_LEN = 120
const DEFAULT_TOP_K = 24
const MAX_TOP_K = 60

/**
 * GET /api/search/visual?q=crvena+cvetna+haljina&topK=24&translate=true
 *
 * Multilingual visual search backed by Marqo-FashionSigLIP text embedding + FAISS.
 * The query is translated to English via Ollama when it looks non-English, then
 * embedded with the same model used for item images so text and image share the
 * embedding space.
 */
router.get('/visual', maybeAuth, async (req, res) => {
  try {
    const rawQuery = String(req.query.q || '').trim()
    if (rawQuery.length < MIN_QUERY_LEN) {
      return res.status(400).json({ error: `query must be at least ${MIN_QUERY_LEN} chars` })
    }
    if (rawQuery.length > MAX_QUERY_LEN) {
      return res.status(400).json({ error: `query must be at most ${MAX_QUERY_LEN} chars` })
    }

    const topK = Math.min(
      MAX_TOP_K,
      Math.max(1, parseInt(req.query.topK, 10) || DEFAULT_TOP_K)
    )
    const candidateTopK = Math.min(MAX_TOP_K, Math.max(topK * 4, topK + 12))
    const translate = req.query.translate !== 'false'
    const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : ''

    if (!(await pingAiServer())) {
      return res.status(503).json({ error: 'AI server unavailable' })
    }

    const searchResult = await textSearch(rawQuery, { topK: candidateTopK, translate, excludeId })
    const hits = Array.isArray(searchResult.results) ? searchResult.results : []

    if (hits.length === 0) {
      return res.json({
        ok: true,
        query: rawQuery,
        translated: searchResult.translated || '',
        data: [],
      })
    }

    const validIds = hits
      .map((hit) => hit.item_id)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    const currentUserId = req.user?._id
    const [blockedUserIds, hiddenItemIds] = await Promise.all([
      getBlockedUserIds(currentUserId),
      getHiddenItemIds(currentUserId),
    ])

    const items = await Item.find({
      _id: { $in: validIds },
      isDeleted: false,
      status: { $in: ['available', 'pending_trade'] },
      ...(blockedUserIds.length > 0 ? { userId: { $nin: blockedUserIds } } : {}),
      ...(hiddenItemIds.length > 0 ? { _id: { $in: validIds, $nin: hiddenItemIds } } : {}),
    })
      .populate('userId', 'username displayName avatarUrl')
      .lean()

    const itemsById = new Map(items.map((item) => [String(item._id), item]))
    const orderedItems = hits
      .map((hit) => {
        const doc = itemsById.get(String(hit.item_id))
        if (!doc) return null
        return { ...doc, similarityScore: hit.score }
      })
      .filter(Boolean)

    const enriched = await enrichItems(orderedItems, currentUserId)
    const presented = enriched.map((item) => {
      const hydrated = withPrimaryImage(item)
      delete hydrated.embedding
      return hydrated
    })

    res.json({
      ok: true,
      query: rawQuery,
      translated: searchResult.translated || '',
      model: searchResult.model || '',
      data: presented.slice(0, topK),
    })
  } catch (err) {
    console.error('[Search] Visual search failed:', err.message)
    res.status(500).json({ error: 'visual search failed', detail: err.message })
  }
})

module.exports = router
