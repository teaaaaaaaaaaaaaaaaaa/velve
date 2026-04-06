const BlockedUser = require('../models/BlockedUser')
const HiddenItem = require('../models/HiddenItem')
const Like = require('../models/Like')
const Wishlist = require('../models/Wishlist')
const TradeRequest = require('../models/TradeRequest')
const ItemView = require('../models/ItemView')
const Item = require('../models/Item')

function normalizeWeightMap(weightMap) {
  const entries = Object.entries(weightMap)
  if (entries.length === 0) return {}

  const maxWeight = Math.max(...entries.map(([, weight]) => weight), 1)
  return Object.fromEntries(
    entries.map(([key, weight]) => [key, Math.min(weight / maxWeight, 1)])
  )
}

function addWeightedKey(map, key, weight) {
  if (!key) return
  const normalizedKey = String(key).trim().toLowerCase()
  if (!normalizedKey) return
  map[normalizedKey] = (map[normalizedKey] || 0) + weight
}

function cosineSimilarity(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0
  }

  let dot = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < a.length; i += 1) {
    const valueA = Number(a[i]) || 0
    const valueB = Number(b[i]) || 0
    dot += valueA * valueB
    magnitudeA += valueA * valueA
    magnitudeB += valueB * valueB
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
}

async function getBlockedUserIds(userId) {
  if (!userId) return []

  const [outboundBlocks, inboundBlocks] = await Promise.all([
    BlockedUser.find({ userId }).select('blockedUserId').lean(),
    BlockedUser.find({ blockedUserId: userId }).select('userId').lean(),
  ])

  return [
    ...new Set([
      ...outboundBlocks.map((entry) => entry.blockedUserId.toString()),
      ...inboundBlocks.map((entry) => entry.userId.toString()),
    ]),
  ]
}

async function getHiddenItemIds(userId) {
  if (!userId) return []

  const hiddenItems = await HiddenItem.find({ userId }).select('itemId').lean()
  return hiddenItems.map((entry) => entry.itemId.toString())
}

async function getDiscoverySignals(userId) {
  if (!userId) {
    return {
      blockedUserIds: [],
      hiddenItemIds: [],
      brandWeights: {},
      categoryWeights: {},
      sizeWeights: {},
      preferredEmbeddings: [],
    }
  }

  const [blockedUserIds, hiddenItemIds, likes, wishlist, views, trades] = await Promise.all([
    getBlockedUserIds(userId),
    getHiddenItemIds(userId),
    Like.find({ userId }).sort({ createdAt: -1 }).limit(40).select('itemId').lean(),
    Wishlist.find({ userId }).sort({ createdAt: -1 }).limit(40).select('itemId').lean(),
    ItemView.find({ userId }).sort({ lastViewedAt: -1 }).limit(40).select('itemId viewCount').lean(),
    TradeRequest.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('offeredItemId requestedItemId')
      .lean(),
  ])

  const weightedSignals = new Map()
  const registerSignal = (itemId, weight) => {
    if (!itemId) return
    const key = itemId.toString()
    weightedSignals.set(key, (weightedSignals.get(key) || 0) + weight)
  }

  likes.forEach((entry) => registerSignal(entry.itemId, 1))
  wishlist.forEach((entry) => registerSignal(entry.itemId, 0.85))
  views.forEach((entry) => registerSignal(entry.itemId, Math.min(0.2 + (entry.viewCount || 1) * 0.08, 0.6)))
  trades.forEach((entry) => {
    registerSignal(entry.offeredItemId, 0.9)
    registerSignal(entry.requestedItemId, 0.9)
  })

  const signalItemIds = [...weightedSignals.keys()]

  if (signalItemIds.length === 0) {
    return {
      blockedUserIds,
      hiddenItemIds,
      brandWeights: {},
      categoryWeights: {},
      sizeWeights: {},
      preferredEmbeddings: [],
    }
  }

  const signalItems = await Item.find({
    _id: { $in: signalItemIds },
    isDeleted: false,
  })
    .select('brand category size embedding')
    .lean()

  const rawBrandWeights = {}
  const rawCategoryWeights = {}
  const rawSizeWeights = {}
  const preferredEmbeddings = []

  for (const item of signalItems) {
    const weight = weightedSignals.get(item._id.toString()) || 0
    addWeightedKey(rawBrandWeights, item.brand, weight)
    addWeightedKey(rawCategoryWeights, item.category, weight)
    addWeightedKey(rawSizeWeights, item.size, weight)

    if (Array.isArray(item.embedding) && item.embedding.length > 0) {
      preferredEmbeddings.push(item.embedding)
    }
  }

  return {
    blockedUserIds,
    hiddenItemIds,
    brandWeights: normalizeWeightMap(rawBrandWeights),
    categoryWeights: normalizeWeightMap(rawCategoryWeights),
    sizeWeights: normalizeWeightMap(rawSizeWeights),
    preferredEmbeddings: preferredEmbeddings.slice(0, 12),
  }
}

function getBehavioralAffinity(item, signals = {}) {
  const brandScore = signals.brandWeights?.[String(item.brand || '').trim().toLowerCase()] || 0
  const categoryScore = signals.categoryWeights?.[String(item.category || '').trim().toLowerCase()] || 0
  const sizeScore = signals.sizeWeights?.[String(item.size || '').trim().toLowerCase()] || 0

  return Math.min(0.45 * brandScore + 0.4 * categoryScore + 0.15 * sizeScore, 1)
}

function getVisualSimilarity(item, signals = {}) {
  if (!Array.isArray(item.embedding) || item.embedding.length === 0) return 0
  if (!Array.isArray(signals.preferredEmbeddings) || signals.preferredEmbeddings.length === 0) return 0

  let bestSimilarity = -1
  for (const embedding of signals.preferredEmbeddings) {
    bestSimilarity = Math.max(bestSimilarity, cosineSimilarity(item.embedding, embedding))
  }

  return Math.max(0, Math.min(1, (bestSimilarity + 1) / 2))
}

module.exports = {
  getBlockedUserIds,
  getHiddenItemIds,
  getDiscoverySignals,
  getBehavioralAffinity,
  getVisualSimilarity,
  cosineSimilarity,
}
