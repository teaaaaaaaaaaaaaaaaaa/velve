import { useState, useEffect } from 'react'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  User,
} from 'firebase/auth'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'

WebBrowser.maybeCompleteAuthSession()

const auth = getAuth()

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signInWithGoogle() {
    // TODO: Nedelja 1 — dodati Google OAuth client ID iz Firebase konzole
    // i konfigurisati expo-auth-session sa pravim redirectUri
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'velve' })
    console.log('Google Sign-In redirect URI:', redirectUri)
    throw new Error('Google Sign-In nije još konfigurisan — dodati CLIENT_ID')
  }

  async function signInWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    return signOut(auth)
  }

  return { currentUser, loading, signInWithGoogle, signInWithEmail, logout }
}
