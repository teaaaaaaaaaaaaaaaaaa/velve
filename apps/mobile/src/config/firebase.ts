/**
 * React Native Firebase configuration
 *
 * NOTE: React Native Firebase reads configuration from native files:
 * - Android: android/app/google-services.json
 * - iOS: ios/GoogleService-Info.plist
 *
 * These files are generated during `npx expo prebuild` from app.json
 */

import { getApp } from '@react-native-firebase/app'
import { getAuth, getIdToken, type FirebaseAuthTypes } from '@react-native-firebase/auth'

const firebaseApp = getApp()
const auth = getAuth(firebaseApp)
const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? ''

console.log('[Firebase] React Native Firebase initialized')
console.log('[Firebase] Initial currentUser:', auth.currentUser ? auth.currentUser.uid : 'none')

function getGoogleOAuthConfigError(clientId: string) {
  if (!clientId) {
    return 'EXPO_PUBLIC_GOOGLE_CLIENT_ID is not defined. Google Sign-In will not work.'
  }

  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    return 'EXPO_PUBLIC_GOOGLE_CLIENT_ID does not match expected format (.apps.googleusercontent.com).'
  }

  if (/example|placeholder|YOUR_/i.test(clientId)) {
    return 'EXPO_PUBLIC_GOOGLE_CLIENT_ID appears to be a placeholder. Update .env with real credentials.'
  }

  return null
}

const googleOAuthConfigError = getGoogleOAuthConfigError(googleClientId)

if (googleOAuthConfigError) {
  console.warn(`[Firebase] WARNING: ${googleOAuthConfigError}`)
} else {
  console.log('[Firebase] Google OAuth config validated successfully')
}

console.log('[Firebase] Auth module ready')

async function getAuthToken(user: FirebaseAuthTypes.User, forceRefresh = false) {
  console.log('[Firebase] getAuthToken:start', {
    uid: user.uid,
    forceRefresh,
  })
  const token = await getIdToken(user, forceRefresh)
  console.log('[Firebase] getAuthToken:success', {
    uid: user.uid,
    tokenLength: token.length,
  })
  return token
}

export { auth, firebaseApp, googleClientId, googleOAuthConfigError, getAuthToken }
