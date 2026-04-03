import '../global.css'
import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments, ErrorBoundary } from 'expo-router'
import { useAuth, useAuthProvider, AuthContext } from '@/hooks/useAuth'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export { ErrorBoundary }

function AuthGate() {
  const { currentUser, loading } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  // Register push notifications when user is logged in
  usePushNotifications()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === 'onboarding'
    const inTabs = segments[0] === '(tabs)'
    const isIndex = segments.length === 0 || segments[0] === 'index'

    if (!currentUser && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (currentUser && inAuthGroup) {
      // When user logs in, go to index to check onboarding status
      router.replace('/')
    } else if (currentUser && !inOnboarding && !inTabs && !isIndex) {
      // If user is logged in but not in a valid route, go to index
      router.replace('/')
    }
  }, [currentUser, loading, segments])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="items/[id]" />
    </Stack>
  )
}

export default function RootLayout() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <AuthGate />
    </AuthContext.Provider>
  )
}
