const admin = require('firebase-admin')
const User = require('../models/User')

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  })
}

/**
 * Middleware: verifikuje Firebase ID token iz Authorization headera.
 * Attachuje dekodovani token na req.user.
 * Auto-kreira MongoDB User dokument pri prvom loginu (ensureUser).
 * Attachuje MongoDB user na req.dbUser.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.split('Bearer ')[1]
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.user = decoded

    // ensureUser: find or create MongoDB user from Firebase UID
    let dbUser = await User.findOne({ firebaseUid: decoded.uid })
    if (!dbUser) {
      const emailPrefix = (decoded.email || '').split('@')[0]
      dbUser = await User.create({
        firebaseUid: decoded.uid,
        email: decoded.email || '',
        displayName: decoded.name || emailPrefix || 'Korisnik',
        photoURL: decoded.picture || '',
      })
    } else if (!dbUser.displayName) {
      // Retroaktivno popuni displayName za stare korisnike
      const emailPrefix = (dbUser.email || '').split('@')[0]
      dbUser = await User.findByIdAndUpdate(
        dbUser._id,
        { displayName: emailPrefix || 'Korisnik' },
        { new: true }
      )
    }
    req.dbUser = dbUser

    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { requireAuth }
