const BlockedUser = require('../models/BlockedUser')
const User = require('../models/User')

async function isBlockedRelation(leftUserId, rightUserId) {
  if (!leftUserId || !rightUserId) return false
  if (String(leftUserId) === String(rightUserId)) return false

  return Boolean(
    await BlockedUser.exists({
      $or: [
        { userId: leftUserId, blockedUserId: rightUserId },
        { userId: rightUserId, blockedUserId: leftUserId },
      ],
    })
  )
}

async function assertCanInteract(viewerId, targetUserId, message = 'You cannot interact with this user') {
  const targetUser = await User.findById(targetUserId).select('accountStatus').lean()
  if (!targetUser || targetUser.accountStatus === 'suspended') {
    const err = new Error(message)
    err.statusCode = 403
    throw err
  }

  if (await isBlockedRelation(viewerId, targetUserId)) {
    const err = new Error(message)
    err.statusCode = 403
    throw err
  }
}

module.exports = {
  assertCanInteract,
  isBlockedRelation,
}
