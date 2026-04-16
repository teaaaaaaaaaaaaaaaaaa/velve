const Item = require('../models/Item')
const { pingAiServer, generateEmbedding, addEmbeddingToIndex } = require('./aiClient')

const BATCH_SIZE = 50
const PER_ITEM_DELAY_MS = 200

/**
 * Retry generating embeddings for items that have images but no embedding vector.
 * Skips early if AI server is unreachable so we don't spam ECONNREFUSED errors.
 */
async function retryMissingEmbeddings() {
  console.log('[Embeddings] Starting retry for missing embeddings...')
  const startTime = Date.now()

  const aiUp = await pingAiServer()
  if (!aiUp) {
    console.warn('[Embeddings] AI server unreachable - skipping retry until next interval')
    return { skipped: true }
  }

  try {
    const items = await Item.find({
      images: { $ne: [] },
      $or: [
        { embedding: { $exists: false } },
        { embedding: { $size: 0 } },
      ],
      isDeleted: false,
    })
      .limit(BATCH_SIZE)
      .lean()

    if (items.length === 0) {
      console.log('[Embeddings] No items need embedding retry')
      return { processed: 0 }
    }

    console.log(`[Embeddings] Retrying ${items.length} items...`)

    let successCount = 0
    let failCount = 0

    for (const item of items) {
      const sourceImage = item.imageClean || item.images?.[0]
      if (!sourceImage) {
        failCount += 1
        continue
      }

      try {
        const embedding = await generateEmbedding(sourceImage)
        await Item.findByIdAndUpdate(item._id, { embedding })
        successCount += 1

        addEmbeddingToIndex(item._id, embedding).catch((err) =>
          console.warn(`[Embeddings] Index-add failed for ${item._id}: ${err.message}`)
        )
      } catch (err) {
        failCount += 1
        console.error(`[Embeddings] Failed for item ${item._id}: ${err.message}`)
      }

      await new Promise((resolve) => setTimeout(resolve, PER_ITEM_DELAY_MS))
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[Embeddings] Retry completed in ${duration}s - Success: ${successCount}, Failed: ${failCount}`)
    return { processed: items.length, successCount, failCount }
  } catch (err) {
    console.error('[Embeddings] Retry failed:', err.message)
    return { error: err.message }
  }
}

module.exports = { retryMissingEmbeddings }
