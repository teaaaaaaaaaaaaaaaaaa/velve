const Item = require('../models/Item')
const Like = require('../models/Like')
const TradeRequest = require('../models/TradeRequest')

/**
 * Update engagement scores for all items
 * Scoring: 60% freshness + 40% engagement
 * - Freshness: 1.0 (brand new) → 0.0 (30+ days old)
 * - Engagement: normalized likes + trades (trades weigh 2x)
 *
 * Call this periodically (hourly cron job recommended)
 */
async function updateEngagementScores() {
  console.log('[Engagement] Starting score update...')
  const startTime = Date.now()

  try {
    // Fetch all items (limit to recently active ones to avoid processing old items)
    const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days
    const items = await Item.find({ createdAt: { $gte: cutoffDate }, status: 'available', isDeleted: false }).lean()

    console.log(`[Engagement] Processing ${items.length} items...`)

    const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days in ms
    const now = Date.now()

    // Process in batches to avoid overload
    const batchSize = 100
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const itemIds = batch.map((item) => item._id)

      // Batch fetch engagement counts
      const [likeCounts, tradeCounts] = await Promise.all([
        Like.aggregate([
          { $match: { itemId: { $in: itemIds } } },
          { $group: { _id: '$itemId', count: { $sum: 1 } } },
        ]),
        TradeRequest.aggregate([
          {
            $match: {
              $or: [{ offeredItemId: { $in: itemIds } }, { requestedItemId: { $in: itemIds } }],
            },
          },
          {
            $group: {
              _id: { $cond: [{ $in: ['$offeredItemId', itemIds] }, '$offeredItemId', '$requestedItemId'] },
              count: { $sum: 1 },
            },
          },
        ]),
      ])

      const likeMap = Object.fromEntries(likeCounts.map((l) => [l._id.toString(), l.count]))
      const tradeMap = Object.fromEntries(tradeCounts.map((t) => [t._id.toString(), t.count]))

      // Update each item
      const updates = batch.map((item) => {
        const age = now - new Date(item.createdAt).getTime()
        const freshness = Math.max(0, 1 - age / maxAge)

        const likes = likeMap[item._id.toString()] || 0
        const trades = tradeMap[item._id.toString()] || 0
        const engagement = Math.min((likes + trades * 2) / 10, 1)

        const score = 0.6 * freshness + 0.4 * engagement

        return {
          updateOne: {
            filter: { _id: item._id },
            update: {
              engagementScore: score,
              lastScoreUpdate: new Date(),
            },
          },
        }
      })

      // Bulk write
      if (updates.length > 0) {
        await Item.bulkWrite(updates)
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[Engagement] Score update completed in ${duration}s`)
  } catch (err) {
    console.error('[Engagement] Score update failed:', err.message)
  }
}

module.exports = { updateEngagementScores }
