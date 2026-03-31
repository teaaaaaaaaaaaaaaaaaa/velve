const Item = require('../models/Item')

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'

/**
 * Retry generating embeddings for items that have images but no embedding vector.
 * This handles cases where AI server was down or embedding generation failed.
 *
 * Call this periodically (every 10-15 minutes recommended)
 */
async function retryMissingEmbeddings() {
  console.log('[Embeddings] Starting retry for missing embeddings...')
  const startTime = Date.now()

  try {
    // Find items with images but no embedding (or empty embedding)
    const items = await Item.find({
      images: { $ne: [] },
      $or: [
        { embedding: { $exists: false } },
        { embedding: { $size: 0 } },
      ],
      isDeleted: false,
    })
      .limit(50) // Process max 50 items per run to avoid overload
      .lean()

    if (items.length === 0) {
      console.log('[Embeddings] No items need embedding retry')
      return
    }

    console.log(`[Embeddings] Retrying ${items.length} items...`)

    let successCount = 0
    let failCount = 0

    // Process items sequentially to avoid overwhelming AI server
    for (const item of items) {
      try {
        const response = await fetch(`${AI_SERVER_URL}/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: item.images[0] }),
          timeout: 30000, // 30s timeout
        })

        if (!response.ok) {
          throw new Error(`AI server responded with ${response.status}`)
        }

        const data = await response.json()

        if (data.embedding && Array.isArray(data.embedding)) {
          await Item.findByIdAndUpdate(item._id, { embedding: data.embedding })
          successCount++
        } else {
          failCount++
          console.warn(`[Embeddings] Invalid embedding response for item ${item._id}`)
        }
      } catch (err) {
        failCount++
        console.error(`[Embeddings] Failed to generate embedding for item ${item._id}:`, err.message)
      }

      // Small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[Embeddings] Retry completed in ${duration}s - Success: ${successCount}, Failed: ${failCount}`)
  } catch (err) {
    console.error('[Embeddings] Retry failed:', err.message)
  }
}

module.exports = { retryMissingEmbeddings }
