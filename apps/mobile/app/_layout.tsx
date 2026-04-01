import '../global.css'
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function RootLayout() {
  const { currentUser, loading } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  console.log('[RootLayout] Rendering, auth:', { user: !!currentUser, loading, segments })

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    console.log('[RootLayout] Auth redirect check:', { currentUser: !!currentUser, inAuthGroup })

    if (!currentUser && !inAuthGroup) {
      console.log('[RootLayout] Redirecting to login')
      router.replace('/(auth)/login')
    } else if (currentUser && inAuthGroup) {
      console.log('[RootLayout] Redirecting to feed')
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
