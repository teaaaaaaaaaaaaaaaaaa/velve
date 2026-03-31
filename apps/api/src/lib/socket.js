const { Server } = require('socket.io')
const mongoose = require('mongoose')
const admin = require('firebase-admin')
const User = require('../models/User')
const Chat = require('../models/Chat')
const Message = require('../models/Message')
const { sendPushToUser } = require('./pushNotifications')

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        'exp://localhost:8081',
        'http://localhost:8081',
        'https://velve.app',
      ],
      credentials: true,
    },
  })

  // Auth middleware: verify Firebase token on connection
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
    // Auto-join user's personal room for direct events
    socket.join(`user:${socket.userId}`)

    // Join a chat room
    socket.on('join_chat', async (chatId) => {
      try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
          return
        }

        const chat = await Chat.findById(chatId).lean()
        if (!chat) return

        const isParticipant = chat.participants.some((p) => p.toString() === socket.userId)
        if (!isParticipant) return

        socket.join(`chat:${chatId}`)
      } catch (err) {
        console.error('join_chat error:', err.message)
      }
    })

    // Leave a chat room
    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat:${chatId}`)
    })

    // Send a message in a chat
    socket.on('send_message', async ({ chatId, text }) => {
      try {
        if (!text?.trim()) return

        const chat = await Chat.findById(chatId)
        if (!chat) return

        const isParticipant = chat.participants.some((p) => p.toString() === socket.userId)
        if (!isParticipant) return

        // Create Message document
        const message = await Message.create({
          chatId,
          senderId: socket.dbUser._id,
          text: text.trim().slice(0, 1000),
        })

        // Update chat's lastMessageAt
        await Chat.findByIdAndUpdate(chatId, { lastMessageAt: message.createdAt })

        // Broadcast to all in the chat room with populated sender info
        io.to(`chat:${chatId}`).emit('new_message', {
          chatId,
          message: {
            _id: message._id,
            chatId: message.chatId,
            senderId: { _id: socket.dbUser._id, displayName: socket.dbUser.displayName, photoURL: socket.dbUser.photoURL },
            text: message.text,
            createdAt: message.createdAt,
          },
        })

        // Push notification to other participant (if not in the room)
        const otherUserId = chat.participants.find((p) => p.toString() !== socket.userId)
        if (otherUserId) {
          const otherSocketIds = await io.in(`chat:${chatId}`).fetchSockets()
          const otherOnline = otherSocketIds.some((s) => s.userId === otherUserId.toString())

          if (!otherOnline) {
            sendPushToUser(otherUserId, {
              title: socket.dbUser.displayName || 'New message',
              body: text.trim().slice(0, 100),
              data: { type: 'chat_message', chatId },
            })
          }
        }
      } catch (err) {
        console.error('send_message error:', err.message)
      }
    })

    // Typing indicator
    socket.on('typing', (chatId) => {
      socket.to(`chat:${chatId}`).emit('user_typing', {
        chatId,
        userId: socket.userId,
        displayName: socket.dbUser.displayName,
      })
    })

    socket.on('disconnect', () => {
      // cleanup handled automatically by socket.io
    })
  })

  return io
}

module.exports = { initSocket }
