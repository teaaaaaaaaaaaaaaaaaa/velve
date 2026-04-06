import { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter, useSegments } from 'expo-router'

import { BrandBackground } from '@/components/BrandBackground'
import { BrandedLoader } from '@/components/BrandedLoader'
import { GlassSurface } from '@/components/GlassSurface'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'

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
  const { locale } = useI18n()

  const copy = {
    sr: {
      profileLoadTitle: 'Ne mozemo da ucitamo profil',
      profileLoadDescription: 'Firebase prijava je prosla, ali backend profil nije stigao.',
      retry: 'Pokusaj ponovo',
      logout: 'Odjavi se',
      loading: 'Velve proverava tvoj ulaz u aplikaciju',
    },
    en: {
      profileLoadTitle: 'We could not load the profile',
      profileLoadDescription: 'Firebase sign-in worked, but the backend profile did not arrive.',
      retry: 'Try again',
      logout: 'Log out',
      loading: 'Velve is checking your app entry',
    },
    ru: {
      profileLoadTitle: 'Не удается загрузить профиль',
      profileLoadDescription: 'Вход через Firebase прошел, но backend-профиль не загрузился.',
      retry: 'Попробовать снова',
      logout: 'Выйти',
      loading: 'Velve проверяет твой вход в приложение',
    },
  } as const

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
      <View className="flex-1 bg-base-canvas px-gutter pt-20">
        <BrandBackground />

        <GlassSurface className="px-6 py-6">
          <Text className="text-center font-display text-3xl text-ink-dark">
            {copy[locale].profileLoadTitle}
          </Text>
          <Text className="mt-3 text-center font-sans text-sm leading-6 text-ink-dark/68">
            {copy[locale].profileLoadDescription}
          </Text>
          <Text className="mt-5 text-center font-mono text-xs text-ink-dark/58">
            {String(profileError)}
          </Text>

          <TouchableOpacity
            className="mt-6 items-center rounded-pill bg-brand-accent-deep px-6 py-4"
            onPress={refreshDbUser}
          >
            <Text className="font-sans text-base font-semibold text-base-canvas">
              {copy[locale].retry}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-3 items-center rounded-pill border border-brand-accent-deep/12 bg-base-canvas/72 px-6 py-4"
            onPress={logout}
          >
            <Text className="font-sans text-base text-ink-dark">{copy[locale].logout}</Text>
          </TouchableOpacity>
        </GlassSurface>
      </View>
    )
  }

  return <BrandedLoader label={copy[locale].loading} />
}
