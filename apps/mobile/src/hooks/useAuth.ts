import { useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  User,
} from 'firebase/auth'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { auth } from '@/config/firebase'

WebBrowser.maybeCompleteAuthSession()

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('[useAuth] Setting up onAuthStateChanged listener')
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[useAuth] Auth state changed:', user ? `User: ${user.email}` : 'No user')
      setCurrentUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signInWithGoogle() {
    console.log('[useAuth] signInWithGoogle called')
    // TODO: Nedelja 1 — dodati Google OAuth client ID iz Firebase konzole
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'velve' })
    console.log('[useAuth] Google Sign-In redirect URI:', redirectUri)
    throw new Error('Google Sign-In nije još konfigurisan — dodati CLIENT_ID')
  }

  async function signInWithEmail(email: string, password: string) {
    console.log('[useAuth] signInWithEmail called for:', email)
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function registerWithEmail(email: string, password: string) {
    console.log('[useAuth] registerWithEmail called for:', email)
    return createUserWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    console.log('[useAuth] logout called')
    return signOut(auth)
  }

  return { currentUser, loading, signInWithGoogle, signInWithEmail, registerWithEmail, logout }
}
