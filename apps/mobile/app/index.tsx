import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter, useSegments } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import client from '@/api/client'

export default function Index() {
  console.log('[Index] Rendering')
  const { currentUser, loading: authLoading } = useAuth()
  const router = useRouter()
  const segments = useSegments()
  const [checkingOnboarding, setCheckingOnboarding] = useState(false)

  useEffect(() => {
    async function checkOnboardingStatus() {
      console.log('[Index] Current segments:', segments)
      console.log('[Index] Auth check:', { user: !!currentUser, loading: authLoading })

      if (authLoading) {
        console.log('[Index] Auth still loading, waiting...')
        return
      }

      // Don't redirect if user is already on a valid route
      const isOnValidRoute = segments.length > 0 && segments[0] !== 'index'
      if (isOnValidRoute) {
        console.log('[Index] User already on valid route, skipping redirect')
        return
      }

      console.log('[Index] Starting onboarding check...')

      if (currentUser) {
        try {
          setCheckingOnboarding(true)
          console.log('[Index] Checking onboarding status...')

          // Fetch user profile to check onboarding status
          const response = await client.get('/api/users/me')
          const userData = response.data?.data || response.data
          const onboardingCompleted = userData?.onboardingCompleted || false

          console.log('[Index] Onboarding completed:', onboardingCompleted)

          if (onboardingCompleted) {
            console.log('[Index] User logged in, redirecting to feed')
            router.replace('/(tabs)/feed')
          } else {
            console.log('[Index] Onboarding not completed, redirecting to onboarding')
            router.replace('/onboarding/welcome')
          }
        } catch (error) {
          console.error('[Index] Error checking onboarding:', error)
          // If error, assume onboarding needed
          console.log('[Index] Error occurred, redirecting to onboarding')
          router.replace('/onboarding/welcome')
        } finally {
          setCheckingOnboarding(false)
        }
      } else {
        console.log('[Index] No user, redirecting to login')
        router.replace('/(auth)/login')
      }
    }

    checkOnboardingStatus()
  }, [currentUser, authLoading, segments])

  return (
    <View className="flex-1 items-center justify-center bg-base-canvas">
      <ActivityIndicator size="large" color="#431A43" />
    </View>
  )
}
