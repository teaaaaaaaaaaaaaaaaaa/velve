import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'

import { BrandBackground } from '@/components/BrandBackground'
import { colors } from '@/design/tokens'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'

export default function SettingsScreen() {
  const router = useRouter()
  const { logout } = useAuth()
  const { locale, setLocale, t } = useI18n()

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('profile.stay'), style: 'cancel' },
      {
        text: t('profile.logoutCta'),
        style: 'destructive',
        onPress: async () => {
          try {
            await logout()
            router.replace('/(auth)/login')
          } catch {
            Alert.alert('Greska', 'Odjava trenutno nije uspela.')
          }
        },
      },
    ])
  }

  return (
    <ScrollView
      className="flex-1 bg-base-canvas"
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      <BrandBackground />
      <View className="px-5 pb-8 pt-14">
        {/* Header */}
        <View className="mb-8 flex-row items-center gap-3">
          <TouchableOpacity
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-tint"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.accentDeep} />
          </TouchableOpacity>
          <Text className="font-display text-3xl text-ink-dark">Podešavanja</Text>
        </View>

        {/* Language section */}
        <View className="overflow-hidden rounded-soft bg-surface-tint px-5 py-5">
          <Text className="font-sans text-[11px] uppercase tracking-[1.2px] text-ink-dark/45">
            {t('profile.languageTitle')}
          </Text>
          <Text className="mt-1 font-display text-2xl text-ink-dark">Izaberi jezik</Text>

          <View className="mt-4 flex-row gap-3">
            {(['sr', 'en', 'ru'] as const).map((language) => {
              const isActive = locale === language
              return (
                <TouchableOpacity
                  key={language}
                  className={`flex-1 items-center rounded-full px-4 py-3 ${
                    isActive
                      ? 'bg-brand-accent-deep'
                      : 'border border-ink-dark/10 bg-base-canvas'
                  }`}
                  onPress={() => setLocale(language)}
                >
                  <Text
                    className={`font-sans text-sm font-semibold ${
                      isActive ? 'text-base-canvas' : 'text-ink-dark'
                    }`}
                  >
                    {t(`language.${language}` as 'language.sr')}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          className="mt-6 items-center rounded-soft border border-signal-danger/20 bg-signal-danger/10 px-5 py-4"
          onPress={handleLogout}
        >
          <Text className="font-sans text-sm font-semibold text-signal-danger">Odjavi se</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
