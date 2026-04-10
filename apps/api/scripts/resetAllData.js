const fs = require('fs/promises')
const path = require('path')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const mongoose = require('mongoose')
const admin = require('firebase-admin')
const {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} = require('@aws-sdk/client-s3')

function ensureFirebaseAdmin() {
  if (admin.apps.length) {
    return admin.app()
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  })
}

function createR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY,
      secretAccessKey: process.env.R2_SECRET_KEY,
    },
  })
}

async function deleteAllFirebaseUsers() {
  ensureFirebaseAdmin()

  let nextPageToken
  let totalDeleted = 0

  do {
    const page = await admin.auth().listUsers(1000, nextPageToken)
    const uids = page.users.map((user) => user.uid)

    if (uids.length > 0) {
      const result = await admin.auth().deleteUsers(uids)
      totalDeleted += result.successCount

      if (result.failureCount > 0) {
        const failures = result.errors
          .map((entry) => `${uids[entry.index]} (${entry.error.message})`)
          .join(', ')
        throw new Error(`Firebase Auth delete failures: ${failures}`)
      }
    }

    nextPageToken = page.pageToken
  } while (nextPageToken)

  return totalDeleted
}

async function deleteAllR2Objects() {
  const bucket = process.env.R2_BUCKET
  if (!bucket) {
    return 0
  }

  const client = createR2Client()
  let continuationToken
  let deleted = 0

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    )

    const objects = (page.Contents || [])
      .map((entry) => entry.Key)
      .filter(Boolean)

    if (objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      )
      deleted += objects.length
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (continuationToken)

  return deleted
}

async function resetMongoDatabase() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db
  const collections = await db.listCollections().toArray()
  await db.dropDatabase()
  return {
    dbName: db.databaseName,
    droppedCollections: collections.map((collection) => collection.name),
  }
}

async function resetAiIndex() {
  const aiServerUrl = process.env.AI_SERVER_URL || 'http://localhost:8000'
  let remoteReset = false

  try {
    const response = await fetch(`${aiServerUrl}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    })

    remoteReset = response.ok
  } catch {
    remoteReset = false
  }

  const aiDataDir = path.resolve(__dirname, '..', '..', 'ai-server', 'data')
  const faissFiles = ['faiss_index.bin', 'faiss_ids.pkl']
  let deletedLocalFiles = 0

  for (const filename of faissFiles) {
    const filepath = path.join(aiDataDir, filename)
    try {
      await fs.rm(filepath, { force: true })
      deletedLocalFiles += 1
    } catch {
      // ignore missing local file cleanup errors
    }
  }

  return {
    remoteReset,
    deletedLocalFiles,
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in apps/api/.env')
  }

  const mongo = await resetMongoDatabase()
  const firebaseDeleted = await deleteAllFirebaseUsers()
  const r2Deleted = await deleteAllR2Objects()
  const ai = await resetAiIndex()

  console.log(
    JSON.stringify(
      {
        ok: true,
        mongo,
        firebaseDeletedUsers: firebaseDeleted,
        r2DeletedObjects: r2Deleted,
        ai,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error('[ResetAllData] Failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await mongoose.disconnect()
    } catch {
      // noop
    }
  })
