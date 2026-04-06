const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const mongoose = require('mongoose')
const Item = require('../src/models/Item')

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in apps/api/.env')
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log('[RebuildSimilarIndex] MongoDB connected')

  const items = await Item.find({
    isDeleted: false,
    'embedding.0': { $exists: true },
  })
    .select('_id embedding')
    .lean()

  console.log(`[RebuildSimilarIndex] Found ${items.length} items with embeddings`)

  const response = await fetch(`${AI_SERVER_URL}/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: items.map((item) => ({
        item_id: String(item._id),
        embedding: item.embedding,
      })),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`AI server responded with ${response.status}${errorText ? ` ${errorText}` : ''}`)
  }

  const data = await response.json()
  console.log('[RebuildSimilarIndex] Done:', JSON.stringify(data))
}

main()
  .catch((error) => {
    console.error('[RebuildSimilarIndex] Failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
