const { getBehavioralAffinity, getVisualSimilarity } = require('./discovery')

/**
 * Computes personalized feed score for items.
 * @param {Array} items - Array of lean() item documents
 * @param {Object} user - User document with preferences
 * @param {Object} signals - Discovery behavior signals for the current user
 * @returns {Array} Items with computed ranking fields
 */
async function rankFeedItems(items, user, signals = {}) {
  const now = Date.now()

  return items.map((item) => {
    // 1. Freshness score (0-1, exponential decay, 7-day half-life)
    const ageMs = now - new Date(item.createdAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    const freshness = Math.exp(-ageDays / 7)

    // 2. Engagement score is already normalized to 0-1 in the background job.
    const engagement = Math.max(0, Math.min(item.engagementScore || 0, 1))

    // 3. Preference match
    let preferenceMatch = 0

    // Brand match
    if (user.favoriteBrands?.includes(item.brand)) {
      preferenceMatch += 0.32
    }

    // Category match
    if (user.categories?.includes(item.category)) {
      preferenceMatch += 0.28
    }

    // Style match
    const styleMatch = user.stylePreferences?.some(s => {
      const styleLower = s.toLowerCase()
      const categoryLower = (item.category || '').toLowerCase()
      const titleLower = (item.title || '').toLowerCase()
      const descriptionLower = (item.description || '').toLowerCase()
      return categoryLower.includes(styleLower) || titleLower.includes(styleLower)
        || descriptionLower.includes(styleLower)
    })
    if (styleMatch) {
      preferenceMatch += 0.2
    }

    // Size match
    const userSize = (item.category || '').includes('Shoes') || (item.category || '').includes('Patike') || (item.category || '').includes('Cipele')
      ? user.sizes?.shoes
      : user.sizes?.clothing
    if (item.size === userSize) {
      preferenceMatch += 0.2
    }

    // Normalize to 0-1
    preferenceMatch = Math.min(preferenceMatch, 1)

    // 4. Behavioral affinity from likes, saves, views, and trade history.
    const behavioralScore = getBehavioralAffinity(item, signals)

    // 5. Visual similarity using stored CLIP embeddings.
    const visualSimilarity = getVisualSimilarity(item, signals)

    // Weighted sum
    const score =
      0.22 * freshness +
      0.18 * engagement +
      0.24 * preferenceMatch +
      0.18 * behavioralScore +
      0.18 * visualSimilarity

    return {
      ...item,
      freshnessScore: freshness,
      normalizedEngagementScore: engagement,
      preferenceScore: preferenceMatch,
      behavioralScore,
      visualSimilarityScore: visualSimilarity,
      personalizedScore: score,
    }
  })
}

module.exports = { rankFeedItems }
