import '../global.css'
import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments, ErrorBoundary } from 'expo-router'
import { useAuth, useAuthProvider, AuthContext } from '@/hooks/useAuth'

export { ErrorBoundary }

function AuthGate() {
  const { currentUser, loading } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!currentUser && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (currentUser && inAuthGroup) {
      router.replace('/(tabs)/feed')
    }
  }, [currentUser, loading, segments])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
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
