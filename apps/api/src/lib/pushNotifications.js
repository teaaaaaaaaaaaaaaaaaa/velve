const { Expo } = require('expo-server-sdk')
const User = require('../models/User')

const expo = new Expo()

/**
 * Send push notification to a user by their MongoDB _id.
 * Silently fails if user has no push token (not critical path).
 */
async function sendPushToUser(userId, { title, body, data = {} }) {
  try {
    const user = await User.findById(userId).select('expoPushToken').lean()
    if (!user?.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) {
      return
    }

    await expo.sendPushNotificationsAsync([
      {
        to: user.expoPushToken,
        sound: 'default',
        title,
        body,
        data,
      },
    ])
  } catch (err) {
    console.error(`Push notification failed for user ${userId}:`, err.message)
  }
}

module.exports = { sendPushToUser }
