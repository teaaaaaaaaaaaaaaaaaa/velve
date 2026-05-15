const express = require('express')
const { Buffer } = require('buffer')
const crypto = require('crypto')
const mongoose = require('mongoose')
const { requireAuth } = require('../middleware/auth')
const Item = require('../models/Item')
const Outfit = require('../models/Outfit')
const { createVtoKey, deleteObject, fetchRemoteBuffer, uploadBuffer } = require('../lib/r2')
const { assertR2PublicUrlWithPrefix } = require('../lib/imageSecurity')
const { getPrimaryImage } = require('../lib/itemPresentation')
const { getInternalAiHeaders } = require('../lib/aiClient')
const {
  VALID_VTO_GARMENT_CATEGORIES,
  resolveGarmentCategoryWithFallback,
} = require('../lib/vtoCategory')

const router = express.Router()
const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'
const VTO_API_TO_AI_TIMEOUT_MS = 150000
const MAX_OUTFIT_ITEMS = 4

function buildRequestId(candidate) {
  const normalized = String(candidate || '').trim()
  if (normalized) {
    return normalized.slice(0, 80)
  }

  return `vto-api-${crypto.randomUUID()}`
}

async function readErrorBody(response) {
  try {
    const body = await response.json()
    return body.detail || body.error || JSON.stringify(body)
  } catch {
    return await response.text()
  }
}

function buildUserFacingVtoError(message, fallback = 'Try-on temporarily unavailable. Pokusaj ponovo za koji minut.') {
  const normalized = String(message || '').trim()
  return normalized || fallback
}

function buildHttpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function isOuterwearCategory(category = '') {
  const normalized = String(category || '').trim().toLowerCase()
  return (
    normalized.includes('jacket') ||
    normalized.includes('jakn') ||
    normalized.includes('coat') ||
    normalized.includes('kaput') ||
    normalized.includes('blazer') ||
    normalized.includes('outerwear')
  )
}

function buildOutfitRenderQueue(items, requestId) {
  const normalizedItems = items.map((item) => ({
    ...item,
    garmentCategory: resolveGarmentCategoryWithFallback(item.category, console),
    isOuterwear: isOuterwearCategory(item.category),
  }))
  const hasOnePiece = normalizedItems.some((item) => item.garmentCategory === 'one-pieces')
  const filteredItems = hasOnePiece
    ? normalizedItems.filter((item) => item.garmentCategory === 'one-pieces' || item.isOuterwear)
    : normalizedItems

  const priorityByCategory = {
    'one-pieces': 0,
    bottoms: 1,
    tops: 2,
  }

  const renderQueue = filteredItems.sort((left, right) => {
    const leftPriority = left.isOuterwear
      ? 3
      : priorityByCategory[left.garmentCategory] ?? Number.MAX_SAFE_INTEGER
    const rightPriority = right.isOuterwear
      ? 3
      : priorityByCategory[right.garmentCategory] ?? Number.MAX_SAFE_INTEGER

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    return String(left._id).localeCompare(String(right._id))
  })

  console.log('[VTO][API] Outfit render queue prepared', {
    requestId,
    hasOnePiece,
    requestedItemIds: items.map((item) => String(item._id)),
    queuedItemIds: renderQueue.map((item) => String(item._id)),
    categoriesUsed: renderQueue.map((item) => item.garmentCategory),
  })

  return renderQueue
}

async function callAiTryOn({
  requestId,
  personImageUrl,
  garmentImageUrl,
  garmentCategory,
}) {
  console.log('[VTO][API] Calling AI server', {
    requestId,
    aiServerUrl: `${AI_SERVER_URL}/virtual-try-on`,
    hasPersonImageUrl: Boolean(personImageUrl),
    hasGarmentImageUrl: Boolean(garmentImageUrl),
    garmentCategory,
  })

  let response
  try {
    response = await fetch(`${AI_SERVER_URL}/virtual-try-on`, {
      method: 'POST',
      headers: getInternalAiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        requestId,
        personImageUrl,
        garmentImageUrl,
        garmentCategory,
      }),
      signal: AbortSignal.timeout(VTO_API_TO_AI_TIMEOUT_MS),
    })
  } catch (error) {
    console.error('[VTO][API] AI server call failed', {
      requestId,
      message: error.message,
    })
    throw buildHttpError(
      502,
      'Try-on temporarily unavailable. AI render server nije odgovorio na vreme.'
    )
  }

  console.log('[VTO][API] AI server response received', {
    requestId,
    status: response.status,
    ok: response.ok,
  })

  if (!response.ok) {
    const message = await readErrorBody(response)
    throw buildHttpError(502, buildUserFacingVtoError(message))
  }

  const payload = await response.json()
  console.log('[VTO][API] AI payload parsed', {
    requestId,
    hasImageUrl: Boolean(payload.imageUrl),
    hasImageBase64: Boolean(payload.imageBase64),
    provider: payload.provider || null,
    model: payload.model || null,
  })

  return payload
}

async function uploadRenderedResult({
  requestId,
  userId,
  itemId,
  aiPayload,
}) {
  const remoteImageUrl = aiPayload.imageUrl || ''
  const remoteImage = remoteImageUrl
    ? await fetchRemoteBuffer(remoteImageUrl)
    : {
        buffer: Buffer.from(String(aiPayload.imageBase64 || ''), 'base64'),
        contentType: 'image/png',
      }

  console.log('[VTO][API] Uploading rendered result to R2', {
    requestId,
    itemId,
    source: remoteImageUrl ? 'imageUrl' : 'imageBase64',
  })

  const uploadResult = await uploadBuffer({
    key: createVtoKey(userId, itemId),
    buffer: remoteImage.buffer,
    contentType: remoteImage.contentType || 'image/png',
  })

  console.log('[VTO][API] Render complete', {
    requestId,
    itemId,
    uploadedUrl: uploadResult.url,
  })

  return {
    ...uploadResult,
    sourceImageUrl: remoteImageUrl,
    renderModel: aiPayload.model || 'fashn-vton-1.5',
    provider: aiPayload.provider || 'modal',
  }
}

router.post('/try-on', requireAuth, async (req, res) => {
  const requestId = buildRequestId(req.body.requestId)

  try {
    const itemId = String(req.body.itemId || '')
    console.log('[VTO][API] Request received', {
      requestId,
      userId: String(req.dbUser?._id || ''),
      itemId,
    })

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'Valid itemId is required' })
    }

    if (!req.dbUser.bodyScanUrl) {
      return res.status(400).json({ error: 'Body scan is required before VTO' })
    }

    const item = await Item.findOne({
      _id: itemId,
      isDeleted: false,
    }).lean()

    if (!item) {
      return res.status(404).json({ error: 'Item not found' })
    }

    if (!item.isDigitized || !item.imageClean) {
      return res.status(400).json({ error: 'Only digitized items can be used in Virtual Try-On' })
    }

    const garmentCategory = resolveGarmentCategoryWithFallback(item.category, console)
    console.log('[VTO][API] Category resolved', {
      requestId,
      itemId,
      sourceCategory: item.category || '',
      garmentCategory,
    })

    const payload = await callAiTryOn({
      requestId,
      personImageUrl: req.dbUser.bodyScanUrl,
      garmentImageUrl: item.imageClean,
      garmentCategory,
    })
    const uploadResult = await uploadRenderedResult({
      requestId,
      userId: req.dbUser._id,
      itemId,
      aiPayload: payload,
    })

    res.json({
      ok: true,
      data: {
        itemId,
        vtoImageUrl: uploadResult.url,
        sourceImageUrl: uploadResult.sourceImageUrl,
        renderModel: uploadResult.renderModel,
        isChainRender: false,
        chainSteps: 1,
        categoriesUsed: [garmentCategory],
      },
    })
  } catch (err) {
    console.error('[VTO][API] Render failed', {
      requestId,
      message: err.message,
      stack: err.stack,
    })
    res.status(err.statusCode || 500).json({
      error: buildUserFacingVtoError(
        err.message,
        'Try-on nije uspeo. Pokusaj ponovo za nekoliko trenutaka.'
      ),
    })
  }
})

router.post('/try-on-outfit', requireAuth, async (req, res) => {
  const requestId = buildRequestId(req.body.requestId)

  try {
    const requestedItemIds = Array.isArray(req.body.itemIds)
      ? [...new Set(req.body.itemIds.map((itemId) => String(itemId || '').trim()).filter(Boolean))]
      : []

    console.log('[VTO][API] Outfit request received', {
      requestId,
      userId: String(req.dbUser?._id || ''),
      requestedItemIds,
    })

    if (requestedItemIds.length === 0 || requestedItemIds.length > MAX_OUTFIT_ITEMS) {
      return res.status(400).json({
        error: `itemIds mora da sadrzi izmedju 1 i ${MAX_OUTFIT_ITEMS} stavke.`,
      })
    }

    if (requestedItemIds.some((itemId) => !mongoose.Types.ObjectId.isValid(itemId))) {
      return res.status(400).json({ error: 'Svi itemIds moraju biti validni.' })
    }

    if (!req.dbUser.bodyScanUrl) {
      return res.status(400).json({ error: 'Body scan is required before VTO' })
    }

    const items = await Item.find({
      _id: { $in: requestedItemIds },
      isDeleted: false,
    }).lean()

    if (items.length !== requestedItemIds.length) {
      return res.status(404).json({ error: 'Jedan ili vise item-a nije pronadjeno.' })
    }

    const invalidItems = items.filter((item) => !item.isDigitized || !item.imageClean)
    if (invalidItems.length > 0) {
      return res.status(400).json({
        error: 'Svi komadi moraju biti digitalizovani i imati clean image za outfit try-on.',
        data: {
          invalidItemIds: invalidItems.map((item) => String(item._id)),
        },
      })
    }

    const renderQueue = buildOutfitRenderQueue(items, requestId)
    let currentPersonImageUrl = req.dbUser.bodyScanUrl
    const stepImages = []
    let renderModel = 'fashn-vton-1.5'

    for (const [index, item] of renderQueue.entries()) {
      const stepRequestId = `${requestId}-step-${index + 1}`
      console.log('[VTO][API] Outfit step started', {
        requestId,
        stepRequestId,
        stepNumber: index + 1,
        itemId: String(item._id),
        garmentCategory: item.garmentCategory,
      })

      const payload = await callAiTryOn({
        requestId: stepRequestId,
        personImageUrl: currentPersonImageUrl,
        garmentImageUrl: item.imageClean,
        garmentCategory: item.garmentCategory,
      })
      const uploadResult = await uploadRenderedResult({
        requestId: stepRequestId,
        userId: req.dbUser._id,
        itemId: String(item._id),
        aiPayload: payload,
      })

      currentPersonImageUrl = uploadResult.url
      renderModel = uploadResult.renderModel
      stepImages.push({
        itemId: String(item._id),
        garmentCategory: item.garmentCategory,
        vtoImageUrl: uploadResult.url,
      })
    }

    return res.json({
      ok: true,
      data: {
        itemIds: renderQueue.map((item) => String(item._id)),
        requestedItemIds,
        vtoImageUrl: currentPersonImageUrl,
        stepImages,
        renderModel,
        isChainRender: stepImages.length > 1,
        chainSteps: stepImages.length,
        categoriesUsed: stepImages.map((step) => step.garmentCategory),
      },
    })
  } catch (err) {
    console.error('[VTO][API] Outfit render failed', {
      requestId,
      message: err.message,
      stack: err.stack,
    })
    return res.status(err.statusCode || 500).json({
      error: buildUserFacingVtoError(
        err.message,
        'Outfit try-on nije uspeo. Pokusaj ponovo za nekoliko trenutaka.'
      ),
    })
  }
})

router.post('/outfits', requireAuth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const vtoImageUrl = String(req.body.vtoImageUrl || '').trim()
    const itemIds = Array.isArray(req.body.itemIds) ? req.body.itemIds.map(String) : []
    const requestedCategories = Array.isArray(req.body.categoriesUsed)
      ? req.body.categoriesUsed.map((entry) => String(entry || '').trim()).filter(Boolean)
      : []

    if (!name) {
      return res.status(400).json({ error: 'name is required' })
    }
    if (!vtoImageUrl) {
      return res.status(400).json({ error: 'vtoImageUrl is required' })
    }
    try {
      assertR2PublicUrlWithPrefix(
        vtoImageUrl,
        `vto/${req.dbUser._id}`,
        'vtoImageUrl must belong to the current user'
      )
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message })
    }
    if (
      itemIds.length === 0 ||
      itemIds.length > MAX_OUTFIT_ITEMS ||
      itemIds.some((itemId) => !mongoose.Types.ObjectId.isValid(itemId))
    ) {
      return res.status(400).json({
        error: `Outfit mora da sadrzi izmedju 1 i ${MAX_OUTFIT_ITEMS} validna itemId.`,
      })
    }

    const outfitItems = await Item.find({
      _id: { $in: itemIds },
      isDeleted: false,
    })
      .select('_id category')
      .lean()

    if (outfitItems.length !== itemIds.length) {
      return res.status(404).json({ error: 'Jedan ili vise outfit item-a nije pronadjeno.' })
    }

    const categoriesUsed = (requestedCategories.length > 0
      ? requestedCategories
      : outfitItems.map((item) => resolveGarmentCategoryWithFallback(item.category, console)))
      .filter((entry) => VALID_VTO_GARMENT_CATEGORIES.includes(entry))

    const outfit = await Outfit.create({
      userId: req.dbUser._id,
      name: name.slice(0, 120),
      itemIds,
      vtoImageUrl,
      renderModel: String(req.body.renderModel || 'fashn-vton-1.5').slice(0, 80),
      isChainRender: Boolean(
        req.body.isChainRender !== undefined ? req.body.isChainRender : itemIds.length > 1
      ),
      chainSteps: Math.max(
        1,
        Math.min(
          MAX_OUTFIT_ITEMS,
          Number(req.body.chainSteps) || Math.max(1, itemIds.length)
        )
      ),
      categoriesUsed,
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

router.delete('/outfits/:id', requireAuth, async (req, res) => {
  try {
    const outfitId = String(req.params.id || '')
    if (!mongoose.Types.ObjectId.isValid(outfitId)) {
      return res.status(400).json({ error: 'Invalid outfit ID' })
    }

    const outfit = await Outfit.findOne({
      _id: outfitId,
      userId: req.dbUser._id,
    }).lean()

    if (!outfit) {
      return res.status(404).json({ error: 'Outfit not found' })
    }

    if (outfit.vtoImageUrl) {
      try {
        const key = assertR2PublicUrlWithPrefix(
          outfit.vtoImageUrl,
          `vto/${req.dbUser._id}`,
          'Outfit image does not belong to the current user'
        )
        await deleteObject(key)
      } catch (error) {
        console.warn('[VTO][API] Failed to delete outfit image from R2', {
          outfitId,
          message: error.message,
        })
      }
    }

    await Outfit.deleteOne({ _id: outfitId, userId: req.dbUser._id })
    res.json({ ok: true, message: 'Outfit deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
