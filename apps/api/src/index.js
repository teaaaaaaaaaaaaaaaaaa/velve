require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const { apiLimiter } = require('./middleware/rateLimit')

const itemsRouter = require('./routes/items')
const feedRouter = require('./routes/feed')
const chatRouter = require('./routes/chat')
const tradesRouter = require('./routes/trades')

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
app.use('/api/feed', feedRouter)
app.use('/api/chat', chatRouter)
app.use('/api/trades', tradesRouter)

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected')
    app.listen(PORT, () => {
      console.log(`Velve API running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message)
    process.exit(1)
  })
