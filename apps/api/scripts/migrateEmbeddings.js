/**
 * Migrate all item embeddings to a new model.
 *
 * Use case: switching CLIP -> FashionSigLIP (512 -> 768 dim).
 * The script:
 *   1. Verifies AI server is up.
 *   2. Resets the FAISS index (in-memory + on-disk files).
 *   3. Clears the `embedding` field on every Item in Mongo.
 *   4. Re-embeds every active item via the new model.
 *   5. Pushes new vectors into FAISS as it goes.
 *
 * Run from apps/api:
 *   node scripts/migrateEmbeddings.js
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const mongoose = require('mongoose')
const Item = require('../src/models/Item')
const {
  pingAiServer,
  fetchAi,
  generateEmbedding,
  addEmbeddingToIndex,
} = require('../src/lib/aiClient')

const PER_ITEM_DELAY_MS = 150
const PROGRESS_EVERY = 10

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in apps/api/.env')
  }

  console.log('[Migrate] Connecting to MongoDB...')
  await mongoose.connect(process.env.MONGODB_URI)

  console.log('[Migrate] Pinging AI server...')
  if (!(await pingAiServer())) {
    throw new Error('AI server unreachable - start it before running this script')
  }

  console.log('[Migrate] Resetting FAISS index (in-memory + disk)...')
  const resetResult = await fetchAi('/reset-index', { body: {} })
  console.log(`[Migrate] FAISS reset: model=${resetResult.model} expected_dim=${resetResult.expected_dim}`)

  console.log('[Migrate] Clearing embedding field on every Item...')
  const cleared = await Item.updateMany({}, { $unset: { embedding: 1 } })
  console.log(`[Migrate] Cleared embeddings on ${cleared.modifiedCount ?? cleared.nModified ?? 0} items`)

  const items = await Item.find({
    isDeleted: false,
    images: { $ne: [] },
  })
    .select('_id images imageClean')
    .lean()

  console.log(`[Migrate] Re-embedding ${items.length} items with the new model...`)

  let success = 0
  let fail = 0
  const failures = []

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    const sourceImage = item.imageClean || item.images?.[0]
    if (!sourceImage) {
      fail += 1
      failures.push({ id: String(item._id), reason: 'no source image' })
      continue
    }

    try {
      const embedding = await generateEmbedding(sourceImage)
      await Item.findByIdAndUpdate(item._id, { embedding })
      try {
        await addEmbeddingToIndex(item._id, embedding)
      } catch (indexErr) {
        console.warn(`[Migrate] Index-add failed for ${item._id}: ${indexErr.message}`)
      }
      success += 1
    } catch (err) {
      fail += 1
      failures.push({ id: String(item._id), reason: err.message })
      console.error(`[Migrate] Embedding failed for ${item._id}: ${err.message}`)
    }

    if ((i + 1) % PROGRESS_EVERY === 0) {
      console.log(`[Migrate] Progress: ${i + 1}/${items.length} (success=${success}, fail=${fail})`)
    }

    await sleep(PER_ITEM_DELAY_MS)
  }

  console.log(`[Migrate] Done. Success: ${success}, Failed: ${fail}`)
  if (failures.length > 0) {
    console.log('[Migrate] First 10 failures:')
    failures.slice(0, 10).forEach((f) => console.log(`  - ${f.id}: ${f.reason}`))
  }
}

main()
  .catch((error) => {
    console.error('[Migrate] Fatal:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
