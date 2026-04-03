/**
 * Computes personalized feed score for items.
 * @param {Array} items - Array of lean() item documents
 * @param {Object} user - User document with preferences
 * @returns {Array} Items with computed 'personalizedScore' field
 */
async function rankFeedItems(items, user) {
  const now = Date.now()

  return items.map((item) => {
    // 1. Freshness score (0-1, exponential decay, 7-day half-life)
    const ageMs = now - new Date(item.createdAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    const freshness = Math.exp(-ageDays / 7)

    // 2. Engagement score (pre-computed, normalize to 0-1)
    const engagement = Math.min((item.engagementScore || 0) / 100, 1)

    // 3. Preference match
    let preferenceMatch = 0

    // Brand match: 0.5 weight
    if (user.favoriteBrands?.includes(item.brand)) {
      preferenceMatch += 0.5
    }

    // Category/style match: 0.3 weight
    if (user.stylePreferences?.includes(item.category)) {
      preferenceMatch += 0.3
    }

    // Size match: 0.2 weight
    if (user.sizes?.clothing === item.size || user.sizes?.shoes === item.size) {
      preferenceMatch += 0.2
    }

    // Normalize to 0-1
    preferenceMatch = Math.min(preferenceMatch, 1)

    // 4. Visual similarity (placeholder - implement later with CLIP)
    const visualSimilarity = 0

    // Weighted sum
    const score = 0.3 * freshness + 0.25 * engagement + 0.25 * preferenceMatch + 0.2 * visualSimilarity

    return {
      ...item,
      personalizedScore: score,
    }
  })
}

module.exports = { rankFeedItems }
