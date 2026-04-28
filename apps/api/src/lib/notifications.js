const mongoose = require('mongoose')
const Notification = require('../models/Notification')

function normalizeObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) return undefined
  return value
}

async function createNotification({
  userId,
  actorUserId,
  type,
  title,
  body = '',
  itemId,
  tradeId,
  chatId,
  data = {},
}) {
  if (!normalizeObjectId(userId)) return null

  try {
    return await Notification.create({
      userId,
      actorUserId: normalizeObjectId(actorUserId),
      type,
      title: String(title || 'Velve').slice(0, 120),
      body: String(body || '').slice(0, 300),
      itemId: normalizeObjectId(itemId),
      tradeId: normalizeObjectId(tradeId),
      chatId: normalizeObjectId(chatId),
      data,
    })
  } catch (err) {
    console.warn('[Notifications] create failed:', err.message)
    return null
  }
}

module.exports = {
  createNotification,
}
