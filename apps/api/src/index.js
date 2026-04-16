require('dotenv').config()
const http = require('http')
const os = require('os')
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const { apiLimiter } = require('./middleware/rateLimit')
const { requireAuth } = require('./middleware/auth')
const { initSentry, Sentry } = require('./config/sentry')
const { initSocket } = require('./lib/socket')
const { updateEngagementScores } = require('./lib/updateEngagementScores')
const { retryMissingEmbeddings } = require('./lib/retryMissingEmbeddings')
const { rebuildAiIndex, pingAiServer } = require('./lib/aiClient')

const EMBEDDING_RETRY_INTERVAL_MS = 15 * 60 * 1000 // 15 min
const FAISS_REINDEX_INTERVAL_MS = 60 * 60 * 1000 // 1 h

const itemsRouter = require('./routes/items')
const feedRouter = require('./routes/feed')
const chatRouter = require('./routes/chat')
const tradesRouter = require('./routes/trades')
const uploadRouter = require('./routes/upload')
const usersRouter = require('./routes/users')
const likesRouter = require('./routes/likes')
const followsRouter = require('./routes/follows')
const aiRouter = require('./routes/ai')
const verificationRouter = require('./routes/verification')
const wishlistRouter = require('./routes/wishlist')
const vtoRouter = require('./routes/vto')
const searchRouter = require('./routes/search')

const app = express()
const PORT = process.env.PORT || 3000

function getLocalLanIp() {
  const interfaces = os.networkInterfaces()

  for (const networkInterface of Object.values(interfaces)) {
    for (const address of networkInterface || []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address
      }
    }
  }

  return null
}

// Initialize Sentry early
initSentry(app)
app.use(Sentry.Handlers.requestHandler())
app.use(Sentry.Handlers.tracingHandler())

// Middleware - CORS configuration
app.use(
  cors({
    origin: [
      'exp://localhost:8081', // Expo dev (iOS/Android)
      'http://localhost:8081', // Expo dev (web)
      'https://velve.app', // Production web (add your actual domain)
    ],
    credentials: true,
  })
)
app.use(express.json())
app.use(apiLimiter)

app.use((req, res, next) => {
  const start = Date.now()
  console.log(`[API] -> ${req.method} ${req.originalUrl} from ${req.ip}`)

  res.on('finish', () => {
    console.log(`[API] <- ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`)
  })

  next()
})

// Health check - basic uptime
app.get('/ping', (req, res) => {
  res.json({ status: 200, message: 'Velve API running' })
})

// Health check - comprehensive (MongoDB, AI server)
app.get('/health', async (req, res) => {
  const checks = {
    mongodb: false,
    aiServer: false,
  }

  // Check MongoDB connection
  try {
    await mongoose.connection.db.admin().ping()
    checks.mongodb = true
  } catch (err) {
    console.error('MongoDB health check failed:', err.message)
  }

  // Check AI server connectivity
  try {
    const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000) // 2s timeout

    const response = await fetch(`${AI_SERVER_URL}/ping`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    checks.aiServer = response.ok
  } catch (err) {
    console.error('AI server health check failed:', err.message)
  }

  // Overall health status
  const healthy = Object.values(checks).every((v) => v)
  const statusCode = healthy ? 200 : 503

  res.status(statusCode).json({
    status: statusCode,
    healthy,
    checks,
    timestamp: new Date().toISOString(),
  })
})

// Manual trigger for engagement score update (admin only)
app.post('/api/admin/update-scores', requireAuth, async (req, res) => {
  try {
    await updateEngagementScores()
    res.json({ ok: true, message: 'Engagement scores updated' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Manual trigger for embedding retry (admin only)
app.post('/api/admin/retry-embeddings', requireAuth, async (req, res) => {
  try {
    await retryMissingEmbeddings()
    res.json({ ok: true, message: 'Embedding retry completed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Routes
app.use('/api/items', itemsRouter)
app.use('/api/items', likesRouter)      // /api/items/:id/like
app.use('/api/likes', likesRouter)      // /api/likes (GET user's liked items)
app.use('/api/feed', feedRouter)
app.use('/api/chat', chatRouter)
app.use('/api/trades', tradesRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/users', usersRouter)
app.use('/api/users', followsRouter)    // /api/users/:id/follow
app.use('/api/ai', aiRouter)
app.use('/api/verification', verificationRouter)
app.use('/api/wishlist', wishlistRouter)
app.use('/api/vto', vtoRouter)
app.use('/api/search', searchRouter)

// Sentry error handler (must be before other error middleware)
app.use(Sentry.Handlers.errorHandler())

// Create HTTP server and attach socket.io
const server = http.createServer(app)
const io = initSocket(server)
app.set('io', io) // make io accessible in routes via req.app.get('io')

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected')

    // Initial engagement score update on startup
    console.log('Running initial engagement score update...')
    updateEngagementScores().catch((err) => {
      console.error('Initial score update failed:', err.message)
    })

    // Initial embedding retry on startup
    console.log('Running initial embedding retry...')
    retryMissingEmbeddings().catch((err) => {
      console.error('Initial embedding retry failed:', err.message)
    })

    // Initial FAISS index sync on startup (so /similar works after restart)
    pingAiServer().then((up) => {
      if (!up) {
        console.warn('[FAISS] AI server down on boot - skipping initial reindex')
        return
      }
      rebuildAiIndex()
        .then((data) => console.log(`[FAISS] Initial reindex done: ${JSON.stringify(data)}`))
        .catch((err) => console.error('[FAISS] Initial reindex failed:', err.message))
    })

    // Periodic background workers
    setInterval(() => {
      retryMissingEmbeddings().catch((err) =>
        console.error('[Embeddings] Periodic retry failed:', err.message)
      )
    }, EMBEDDING_RETRY_INTERVAL_MS).unref()

    setInterval(() => {
      pingAiServer().then((up) => {
        if (!up) return
        rebuildAiIndex()
          .then((data) => console.log(`[FAISS] Periodic reindex done: ${JSON.stringify(data)}`))
          .catch((err) => console.error('[FAISS] Periodic reindex failed:', err.message))
      })
    }, FAISS_REINDEX_INTERVAL_MS).unref()

    server.listen(PORT, () => {
      const lanIp = getLocalLanIp()
      console.log(`Velve API running on http://localhost:${PORT}`)
      if (lanIp) {
        console.log(`Velve API running on http://${lanIp}:${PORT}`)
      }
    })
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message)
    process.exit(1)
  })
