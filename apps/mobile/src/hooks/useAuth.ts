import { createContext, useContext, useState, useEffect } from 'react'
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

type AuthContextType = {
  currentUser: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<any>
  registerWithEmail: (email: string, password: string) => Promise<any>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuthProvider() {
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
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'velve' })
    throw new Error('Google Sign-In nije jos konfigurisan — dodati CLIENT_ID')
  }

  async function signInWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function registerWithEmail(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    return signOut(auth)
  }

  return { currentUser, loading, signInWithGoogle, signInWithEmail, registerWithEmail, logout }
}

export { AuthContext }

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
