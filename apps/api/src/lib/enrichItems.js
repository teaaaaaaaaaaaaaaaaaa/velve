const Like = require('../models/Like')
const TradeRequest = require('../models/TradeRequest')
const Wishlist = require('../models/Wishlist')
const { withPrimaryImage } = require('./itemPresentation')

/**
 * Enriches item(s) with engagement metadata.
 * @param {Object|Array} items - Single item or array of items (lean())
 * @param {ObjectId} userId - MongoDB user ID
 * @returns {Object|Array} Enriched item(s)
 */
async function enrichItems(items, userId) {
  const isArray = Array.isArray(items)
  const itemList = isArray ? items : [items]

  if (itemList.length === 0) {
    return isArray ? [] : null
  }

  const itemIds = itemList.map((item) => item._id)

  const [userLikes, userWishlist, likeCounts, wishlistCounts, tradeCounts] = await Promise.all([
    userId
      ? Like.find({ userId, itemId: { $in: itemIds } })
          .select('itemId')
          .lean()
      : [],
    userId
      ? Wishlist.find({ userId, itemId: { $in: itemIds } })
          .select('itemId')
          .lean()
      : [],
    Like.aggregate([
      { $match: { itemId: { $in: itemIds } } },
      { $group: { _id: '$itemId', count: { $sum: 1 } } },
    ]),
    Wishlist.aggregate([
      { $match: { itemId: { $in: itemIds } } },
      { $group: { _id: '$itemId', count: { $sum: 1 } } },
    ]),
    TradeRequest.aggregate([
      { $match: { requestedItemId: { $in: itemIds } } },
      {
        $group: {
          _id: {
            itemId: '$requestedItemId',
            senderId: '$senderId',
          },
        },
      },
      {
        $group: {
          _id: '$_id.itemId',
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  const likedItemIds = new Set(userLikes.map((entry) => entry.itemId.toString()))
  const wishlistedItemIds = new Set(userWishlist.map((entry) => entry.itemId.toString()))

  const likeCountMap = Object.fromEntries(
    likeCounts.map((lc) => [lc._id.toString(), lc.count])
  )
  const wishlistCountMap = Object.fromEntries(
    wishlistCounts.map((entry) => [entry._id.toString(), entry.count])
  )
  const tradeCountMap = Object.fromEntries(
    tradeCounts.map((entry) => [entry._id.toString(), entry.count])
  )

  // Enrich items
  const enriched = itemList.map((item) =>
    withPrimaryImage({
      ...item,
      isLiked: likedItemIds.has(item._id.toString()),
      isWishlisted: wishlistedItemIds.has(item._id.toString()),
      likesCount: likeCountMap[item._id.toString()] || 0,
      wishlistCount: wishlistCountMap[item._id.toString()] || 0,
      tradeRequestsCount: tradeCountMap[item._id.toString()] || 0,
    })
  )

  return isArray ? enriched : enriched[0]
}

module.exports = { enrichItems }
