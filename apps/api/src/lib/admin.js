function parseEnvList(value = '') {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function isBootstrapAdmin(decodedToken = {}) {
  const adminEmails = new Set(parseEnvList(process.env.ADMIN_EMAILS))
  const adminUids = new Set(parseEnvList(process.env.ADMIN_FIREBASE_UIDS))
  const email = String(decodedToken.email || '').trim().toLowerCase()
  const uid = String(decodedToken.uid || '').trim().toLowerCase()

  return (email && adminEmails.has(email)) || (uid && adminUids.has(uid))
}

function hasAdminRole(user) {
  return user?.role === 'admin'
}

function hasModeratorRole(user) {
  return user?.role === 'admin' || user?.role === 'moderator'
}

module.exports = {
  hasAdminRole,
  hasModeratorRole,
  isBootstrapAdmin,
}
