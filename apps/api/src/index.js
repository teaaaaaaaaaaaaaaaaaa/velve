require('dotenv').config()
const http = require('http')
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const { apiLimiter } = require('./middleware/rateLimit')
const { initSocket } = require('./lib/socket')

const itemsRouter = require('./routes/items')
const feedRouter = require('./routes/feed')
const chatRouter = require('./routes/chat')
const tradesRouter = require('./routes/trades')
const uploadRouter = require('./routes/upload')
const usersRouter = require('./routes/users')
const likesRouter = require('./routes/likes')
const followsRouter = require('./routes/follows')
const aiRouter = require('./routes/ai')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())
app.use(apiLimiter)

// Health check
app.get('/ping', (req, res) => {
  res.json({ status: 200, message: 'Velve API running' })
})

// Routes
app.use('/api/items', itemsRouter)
app.use('/api/items', likesRouter)      // /api/items/:id/like
app.use('/api/feed', feedRouter)
app.use('/api/chat', chatRouter)
app.use('/api/trades', tradesRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/users', usersRouter)
app.use('/api/users', followsRouter)    // /api/users/:id/follow
app.use('/api/ai', aiRouter)

// Create HTTP server and attach socket.io
const server = http.createServer(app)
const io = initSocket(server)
app.set('io', io) // make io accessible in routes via req.app.get('io')

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected')
    server.listen(PORT, () => {
      console.log(`Velve API running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message)
    process.exit(1)
  })
