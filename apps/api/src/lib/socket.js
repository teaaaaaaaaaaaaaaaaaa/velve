const { Server } = require('socket.io')
const mongoose = require('mongoose')
const admin = require('firebase-admin')
const User = require('../models/User')
const Chat = require('../models/Chat')
const { createChatMessage, markChatRead } = require('./chatMessages')

const messageBuckets = new Map()

function allowMessage(userId) {
  const now = Date.now()
  const windowMs = 60 * 1000
  const maxMessages = 30
  const bucket = messageBuckets.get(userId) || { count: 0, resetAt: now + windowMs }

  if (bucket.resetAt <= now) {
    bucket.count = 0
    bucket.resetAt = now + windowMs
  }

  bucket.count += 1
  messageBuckets.set(userId, bucket)

  return bucket.count <= maxMessages
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        'exp://localhost:8081',
        'http://localhost:8081',
        'https://velve.app',
        'https://velveapp.com',
        'https://www.velveapp.com',
      ],
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const decoded = await admin.auth().verifyIdToken(token)
      const dbUser = await User.findOne({ firebaseUid: decoded.uid })
      if (!dbUser) {
        return next(new Error('User not found'))
      }
      socket.userId = dbUser._id.toString()
      socket.dbUser = dbUser
      next()
    } catch (err) {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`)

    socket.on('join_chat', async (chatId, ack) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Invalid chat ID' })
          return
        }

        const chat = await Chat.findById(chatId).lean()
        if (!chat) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Chat not found' })
          return
        }

        const isParticipant = chat.participants.some((p) => p.toString() === socket.userId)
        if (!isParticipant) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Not a participant of this chat' })
          return
        }

        socket.join(`chat:${chatId}`)
        if (typeof ack === 'function') ack({ ok: true })
      } catch (err) {
        console.error('join_chat error:', err.message)
        if (typeof ack === 'function') ack({ ok: false, error: err.message })
      }
    })

    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat:${chatId}`)
    })

    socket.on('send_message', async ({ chatId, text, clientId }, ack) => {
      try {
        if (!allowMessage(socket.userId)) {
          if (typeof ack === 'function') {
            ack({ ok: false, error: 'Too many messages, please slow down.', clientId })
          }
          return
        }

        const message = await createChatMessage({
          chatId,
          sender: socket.dbUser,
          text,
          io,
          clientId,
        })

        if (typeof ack === 'function') {
          ack({ ok: true, data: message, clientId })
        }
      } catch (err) {
        console.error('send_message error:', err.message)
        if (typeof ack === 'function') {
          ack({ ok: false, error: err.message, clientId })
        }
      }
    })

    socket.on('mark_read', async (chatId, ack) => {
      try {
        const result = await markChatRead({ chatId, userId: socket.dbUser._id, io })
        if (typeof ack === 'function') ack({ ok: true, data: result })
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message })
      }
    })

    socket.on('typing', (chatId) => {
      socket.to(`chat:${chatId}`).emit('user_typing', {
        chatId,
        userId: socket.userId,
        displayName: socket.dbUser.displayName,
      })
    })
  })

  return io
}

module.exports = { initSocket }
