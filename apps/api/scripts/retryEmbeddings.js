const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const mongoose = require('mongoose')
const { retryMissingEmbeddings } = require('../src/lib/retryMissingEmbeddings')

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in apps/api/.env')
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log('[RetryEmbeddings] MongoDB connected')
  await retryMissingEmbeddings()
}

main()
  .catch((error) => {
    console.error('[RetryEmbeddings] Failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
