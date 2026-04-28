const mongoose = require('mongoose')
const Chat = require('../models/Chat')
const Message = require('../models/Message')
const { sendPushToUser } = require('./pushNotifications')
const { createNotification } = require('./notifications')

function normalizeMessageText(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    const err = new Error('Message text is required')
    err.statusCode = 400
    throw err
  }
  if (trimmed.length > 1000) {
    const err = new Error('Message text must be 1000 characters or less')
    err.statusCode = 400
    throw err
  }
  return trimmed
}

function isChatParticipant(chat, userId) {
  return chat.participants.some((participantId) => String(participantId) === String(userId))
}

function toMessagePayload(message, sender) {
  const raw = typeof message.toObject === 'function' ? message.toObject() : message
  return {
    ...raw,
    senderId: {
      _id: sender._id,
      displayName: sender.displayName,
      photoURL: sender.photoURL,
    },
  }
}

async function createChatMessage({
  chatId,
  sender,
  text,
  io = null,
  skipPushWhenRecipientInRoom = true,
  clientId = null,
}) {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const err = new Error('Invalid chat ID')
    err.statusCode = 400
    throw err
  }

  const normalizedText = normalizeMessageText(text)
  const chat = await Chat.findById(chatId)
  if (!chat) {
    const err = new Error('Chat not found')
    err.statusCode = 404
    throw err
  }

  if (!isChatParticipant(chat, sender._id)) {
    const err = new Error('Not a participant of this chat')
    err.statusCode = 403
    throw err
  }

  const message = await Message.create({
    chatId,
    senderId: sender._id,
    text: normalizedText,
    readBy: [{ userId: sender._id, readAt: new Date() }],
  })

  await Chat.findByIdAndUpdate(chatId, {
    lastMessageAt: message.createdAt,
    lastMessageText: normalizedText,
    lastMessageSenderId: sender._id,
    $pull: { deletedFor: { $in: chat.participants } },
  })

  const messagePayload = toMessagePayload(message, sender)
  if (clientId) {
    messagePayload.clientId = clientId
  }

  if (io) {
    io.to(`chat:${chatId}`).emit('new_message', { chatId, message: messagePayload })

    for (const participantId of chat.participants) {
      if (String(participantId) !== String(sender._id)) {
        io.to(`user:${participantId}`).emit('badge_new_message', { chatId })
        io.to(`user:${participantId}`).emit('chat_updated', {
          chatId,
          lastMessage: messagePayload,
        })
      }
    }
  }

  const recipients = chat.participants.filter((participantId) => String(participantId) !== String(sender._id))
  for (const recipientId of recipients) {
    let recipientInRoom = false
    if (io && skipPushWhenRecipientInRoom) {
      const sockets = await io.in(`chat:${chatId}`).fetchSockets()
      recipientInRoom = sockets.some((socket) => String(socket.userId) === String(recipientId))
    }

    if (!recipientInRoom) {
      createNotification({
        userId: recipientId,
        actorUserId: sender._id,
        type: 'chat_message',
        title: sender.displayName || 'Velve',
        body: normalizedText.slice(0, 100),
        chatId,
        data: {
          chatId: String(chatId),
          messageId: String(message._id),
          senderId: String(sender._id),
        },
      })

      sendPushToUser(recipientId, {
        title: sender.displayName || 'Velve',
        body: normalizedText.slice(0, 100),
        data: {
          type: 'chat_message',
          chatId: String(chatId),
          messageId: String(message._id),
          senderId: String(sender._id),
        },
      })
    }
  }

  return messagePayload
}

async function markChatRead({ chatId, userId, io = null }) {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const err = new Error('Invalid chat ID')
    err.statusCode = 400
    throw err
  }

  const chat = await Chat.findById(chatId).lean()
  if (!chat) {
    const err = new Error('Chat not found')
    err.statusCode = 404
    throw err
  }

  if (!isChatParticipant(chat, userId)) {
    const err = new Error('Not a participant of this chat')
    err.statusCode = 403
    throw err
  }

  const readAt = new Date()
  const result = await Message.updateMany(
    {
      chatId,
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId },
    },
    {
      $push: {
        readBy: {
          userId,
          readAt,
        },
      },
    }
  )

  if (io && result.modifiedCount > 0) {
    io.to(`chat:${chatId}`).emit('messages_read', {
      chatId,
      userId: String(userId),
      readAt,
    })
  }

  return { readAt, modifiedCount: result.modifiedCount }
}

module.exports = {
  createChatMessage,
  isChatParticipant,
  markChatRead,
  normalizeMessageText,
}
