const { Expo } = require('expo-server-sdk')
const User = require('../models/User')

const expo = new Expo()

/**
 * Send push notification to a user by their MongoDB _id.
 * Handles Expo errors gracefully:
 * - DeviceNotRegistered: clears invalid token from database
 * - Rate limits: logs error for monitoring
 * - Other errors: logs for debugging
 */
async function sendPushToUser(userId, { title, body, data = {} }) {
  try {
    const user = await User.findById(userId).select('expoPushToken').lean()
    if (!user?.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) {
      return
    }

    const messages = [
      {
        to: user.expoPushToken,
        sound: 'default',
        title,
        body,
        data,
      },
    ]

    // Send and get tickets
    const tickets = await expo.sendPushNotificationsAsync(messages)

    // Check ticket status for errors
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        // Handle DeviceNotRegistered - clear invalid token
        if (ticket.details?.error === 'DeviceNotRegistered') {
          console.log(`[Push] Clearing invalid token for user ${userId}`)
          await User.findByIdAndUpdate(userId, { expoPushToken: '' })
        }
        // Handle rate limiting
        else if (ticket.details?.error === 'MessageRateExceeded') {
          console.warn(`[Push] Rate limit exceeded for user ${userId}`)
        }
        // Other errors
        else {
          console.error(`[Push] Error for user ${userId}:`, ticket.details)
        }
      }
    }
  } catch (err) {
    console.error(`Push notification failed for user ${userId}:`, err.message)
  }
}

module.exports = { sendPushToUser }
