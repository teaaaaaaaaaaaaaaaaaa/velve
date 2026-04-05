import { useEffect } from 'react'
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native'
import { useRouter, useSegments } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function Index() {
  const {
    currentUser,
    dbUser,
    loading: authLoading,
    profileError,
    refreshDbUser,
    logout,
  } = useAuth()
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
      console.log('[Index] Waiting for dbUser to load. profileError =', profileError)
      return
    }

    // Both currentUser and dbUser loaded - safe to redirect
    if (dbUser.onboardingCompleted) {
      router.replace('/(tabs)/feed')
    } else {
      router.replace('/onboarding/welcome')
    }
  }, [currentUser, dbUser, authLoading, segments])

  if (!authLoading && currentUser && !dbUser && profileError) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas px-6">
        <Text className="mb-3 text-center font-display text-2xl text-ink-dark">
          Ne mozemo da ucitamo profil
        </Text>
        <Text className="mb-6 text-center font-sans text-sm text-ink-dark/70">
          Firebase prijava je prosla, ali backend profil nije stigao.
        </Text>
        <Text className="mb-8 text-center font-mono text-xs text-ink-dark/60">
          {String(profileError)}
        </Text>

        <TouchableOpacity
          className="mb-3 w-full items-center rounded-full bg-brand-accent-deep px-6 py-4"
          onPress={refreshDbUser}
        >
          <Text className="font-sans text-base font-semibold text-base-canvas">
            Pokusaj ponovo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full items-center rounded-full border border-ink-dark px-6 py-4"
          onPress={logout}
        >
          <Text className="font-sans text-base text-ink-dark">
            Odjavi se
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View className="flex-1 items-center justify-center bg-base-canvas">
      <ActivityIndicator size="large" color="#431A43" />
    </View>
  )
}
