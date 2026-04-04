import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter, useSegments } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function Index() {
  const { currentUser, dbUser, loading: authLoading } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (authLoading) return

    const isOnValidRoute = segments.length > 0
    if (isOnValidRoute) return

    if (!currentUser) {
      // Not logged in - go to login
      router.replace('/(auth)/login')
      return
    }

    // Wait for dbUser to load before redirecting
    if (!dbUser) {
      console.log('[Index] Waiting for dbUser to load...')
      return
    }

    // Both currentUser and dbUser loaded - safe to redirect
    if (dbUser.onboardingCompleted) {
      router.replace('/(tabs)/feed')
    } else {
      router.replace('/onboarding/welcome')
    }
  }, [currentUser, dbUser, authLoading, segments])

  return (
    <View className="flex-1 items-center justify-center bg-base-canvas">
      <ActivityIndicator size="large" color="#431A43" />
    </View>
  )
}
