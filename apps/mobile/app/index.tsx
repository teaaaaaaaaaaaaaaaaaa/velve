import { useEffect, useState, useRef } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import client from '@/api/client'

export default function Index() {
  console.log('[Index] Rendering')
  const { currentUser, loading: authLoading } = useAuth()
  const router = useRouter()
  const [checkingOnboarding, setCheckingOnboarding] = useState(false)
  const hasRedirected = useRef(false)
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    // Reset redirect flag when user changes (login/logout)
    const currentUserId = currentUser?.uid || null
    if (lastUserId.current !== currentUserId) {
      hasRedirected.current = false
      lastUserId.current = currentUserId
    }

    // Only run once when auth is ready and we haven't redirected yet
    if (hasRedirected.current) return

    async function checkOnboardingStatus() {
      console.log('[Index] Auth check:', { user: !!currentUser, loading: authLoading })
      if (authLoading) return

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
            hasRedirected.current = true
            router.replace('/(tabs)/feed')
          } else {
            console.log('[Index] Onboarding not completed, redirecting to onboarding')
            hasRedirected.current = true
            router.replace('/onboarding/welcome')
          }
        } catch (error) {
          console.error('[Index] Error checking onboarding:', error)
          // If error, assume onboarding needed
          console.log('[Index] Error occurred, redirecting to onboarding')
          hasRedirected.current = true
          router.replace('/onboarding/welcome')
        } finally {
          setCheckingOnboarding(false)
        }
      } else {
        console.log('[Index] No user, redirecting to login')
        hasRedirected.current = true
        router.replace('/(auth)/login')
      }
    }

    checkOnboardingStatus()
  }, [currentUser, authLoading])

  return (
    <View className="flex-1 items-center justify-center bg-base-canvas">
      <ActivityIndicator size="large" color="#431A43" />
    </View>
  )
}
