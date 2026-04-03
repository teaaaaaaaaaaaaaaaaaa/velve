const Like = require('../models/Like')
const Wishlist = require('../models/Wishlist')

/**
 * Enriches item(s) with isLiked, isWishlisted, likesCount fields.
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

  // Fetch user's likes for these items
  const userLikes = userId
    ? await Like.find({ userId, itemId: { $in: itemIds } })
        .select('itemId')
        .lean()
    : []
  const likedItemIds = new Set(userLikes.map((l) => l.itemId.toString()))

  // Fetch user's wishlist for these items
  const userWishlist = userId
    ? await Wishlist.find({ userId, itemId: { $in: itemIds } })
        .select('itemId')
        .lean()
    : []
  const wishlistedItemIds = new Set(userWishlist.map((w) => w.itemId.toString()))

  // Count total likes per item
  const likeCounts = await Like.aggregate([
    { $match: { itemId: { $in: itemIds } } },
    { $group: { _id: '$itemId', count: { $sum: 1 } } },
  ])
  const likeCountMap = Object.fromEntries(
    likeCounts.map((lc) => [lc._id.toString(), lc.count])
  )

  // Enrich items
  const enriched = itemList.map((item) => ({
    ...item,
    isLiked: likedItemIds.has(item._id.toString()),
    isWishlisted: wishlistedItemIds.has(item._id.toString()),
    likesCount: likeCountMap[item._id.toString()] || 0,
  }))

  return isArray ? enriched : enriched[0]
}

module.exports = { enrichItems }
