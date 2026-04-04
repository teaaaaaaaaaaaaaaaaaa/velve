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

    const isOnValidRoute = segments.length > 0 && segments[0] !== 'index'
    if (isOnValidRoute) return

    if (currentUser) {
      if (dbUser?.onboardingCompleted) {
        router.replace('/(tabs)/feed')
      } else {
        router.replace('/onboarding/welcome')
      }
    } else {
      router.replace('/(auth)/login')
    }
  }, [currentUser, dbUser, authLoading, segments])

  return (
    <View className="flex-1 items-center justify-center bg-base-canvas">
      <ActivityIndicator size="large" color="#431A43" />
    </View>
  )
}
