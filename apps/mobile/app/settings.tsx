import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'
import { getApiErrorMessage } from '@/lib/apiErrors'

type NotificationPreferences = {
  allPush: boolean
  likes: boolean
  follows: boolean
  trades: boolean
  messages: boolean
  ratings: boolean
  marketing: boolean
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  allPush: true,
  likes: true,
  follows: true,
  trades: true,
  messages: true,
  ratings: true,
  marketing: false,
}

type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description?: string
  onPress?: () => void
  danger?: boolean
  right?: ReactNode
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5 rounded-[26px] bg-surface-panel px-4 py-4">
      <Text className="mb-1 font-sans text-xs uppercase tracking-[1.2px] text-ink-dark/45">
        {title}
      </Text>
      {children}
    </View>
  )
}

function SettingRow({ icon, title, description, onPress, danger, right }: SettingRowProps) {
  const content = (
    <>
      <View className={`h-10 w-10 items-center justify-center rounded-full ${danger ? 'bg-signal-danger/10' : 'bg-base-canvas'}`}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.accentDeep} />
      </View>
      <View className="ml-3 flex-1">
        <Text className={`font-sans text-sm font-semibold ${danger ? 'text-signal-danger' : 'text-ink-dark'}`}>
          {title}
        </Text>
        {description ? (
          <Text className="mt-1 font-sans text-xs leading-5 text-ink-dark/52">{description}</Text>
        ) : null}
      </View>
      {right || (onPress ? <Ionicons name="chevron-forward" size={17} color={colors.mutedText} /> : null)}
    </>
  )

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.86} className="mt-3 flex-row items-center rounded-[20px] px-2 py-2">
        {content}
      </TouchableOpacity>
    )
  }

  return <View className="mt-3 flex-row items-center rounded-[20px] px-2 py-2">{content}</View>
}

export default function SettingsScreen() {
  const router = useRouter()
  const { dbUser, logout } = useAuth()
  const { locale, setLocale, t } = useI18n()
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [loadingPreferences, setLoadingPreferences] = useState(true)
  const [savingPreference, setSavingPreference] = useState<keyof NotificationPreferences | null>(null)

  const loadPreferences = useCallback(async () => {
    try {
      const response = await client.get('/api/users/me/notification-preferences')
      if (response.data.ok) {
        setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(response.data.data || {}) })
      }
    } catch {
      // Keep local defaults if the API is temporarily unavailable.
    } finally {
      setLoadingPreferences(false)
    }
  }, [])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

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

  const updatePreference = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      const previous = preferences
      const next = { ...preferences, [key]: value }
      setPreferences(next)
      setSavingPreference(key)

      try {
        const response = await client.put('/api/users/me/notification-preferences', next)
        if (response.data.ok) {
          setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(response.data.data || next) })
        }
      } catch (error) {
        setPreferences(previous)
        Alert.alert('Greska', getApiErrorMessage(error, 'Podesavanje notifikacija nije sacuvano.'))
      } finally {
        setSavingPreference(null)
      }
    },
    [preferences]
  )

  const openExternal = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Greska', 'Link trenutno nije dostupan.'))
  }

  const switchProps = (key: keyof NotificationPreferences) => ({
    value: preferences[key],
    disabled: loadingPreferences || Boolean(savingPreference),
    onValueChange: (value: boolean) => updatePreference(key, value),
    trackColor: { false: '#D6D8CC', true: colors.accentLight },
    thumbColor: preferences[key] ? colors.accentDeep : colors.baseCanvas,
  })

  return (
    <ScrollView className="flex-1 bg-base-canvas" contentContainerStyle={{ paddingBottom: 120 }}>
      <BrandBackground />
      <View className="px-5 pb-8 pt-14">
        <View className="mb-6 flex-row items-center justify-between">
          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Velve account
        </Text>
        <Text className="mt-1 font-display text-4xl text-ink-dark">Podesavanja</Text>

        <SettingsSection title="Nalog">
          <View className="mt-3 flex-row items-center rounded-[22px] bg-base-canvas px-3 py-3">
            {dbUser?.photoURL ? (
              <RemoteImage uri={dbUser.photoURL} className="h-14 w-14 rounded-full" />
            ) : (
              <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-accent-light/35">
                <Text className="font-display text-2xl text-brand-accent-deep">
                  {(dbUser?.displayName || 'V').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View className="ml-3 flex-1">
              <Text className="font-sans text-sm font-semibold text-ink-dark">
                {dbUser?.displayName || 'Velve korisnik'}
              </Text>
              <Text className="mt-1 font-sans text-xs text-ink-dark/50">
                {dbUser?.email || 'Profil i poverenje'}
              </Text>
            </View>
          </View>
          <SettingRow
            icon="person-circle-outline"
            title="Otvori profil"
            description="Pregled javnog profila, ocena i ormara."
            onPress={() => router.push('/(tabs)/profile')}
          />
          <SettingRow
            icon="archive-outline"
            title="Arhiva tradeova"
            description="Zavrsene razmene, istorija i ocenjivanje."
            onPress={() => router.push('/trade-archive')}
          />
        </SettingsSection>

        <SettingsSection title="Jezik">
          <View className="mt-4 flex-row gap-3">
            {(['sr', 'en', 'ru'] as const).map((language) => {
              const isActive = locale === language
              return (
                <TouchableOpacity
                  key={language}
                  className={`flex-1 items-center rounded-full px-4 py-3 ${
                    isActive ? 'bg-brand-accent-deep' : 'border border-ink-dark/10 bg-base-canvas'
                  }`}
                  onPress={() => setLocale(language)}
                >
                  <Text className={`font-sans text-sm font-semibold ${isActive ? 'text-base-canvas' : 'text-ink-dark'}`}>
                    {t(`language.${language}` as 'language.sr')}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </SettingsSection>

        <SettingsSection title="Push notifikacije">
          {loadingPreferences ? (
            <View className="items-center py-5">
              <ActivityIndicator size="small" color={colors.accentDeep} />
            </View>
          ) : null}
          <SettingRow icon="notifications-outline" title="Sve push notifikacije" right={<Switch {...switchProps('allPush')} />} />
          <SettingRow icon="chatbubble-outline" title="Poruke" description="Direktne poruke i chat odgovori." right={<Switch {...switchProps('messages')} />} />
          <SettingRow icon="swap-horizontal-outline" title="Trade tokovi" description="Novi predlozi, prihvatanja, odbijanja i zavrsetak." right={<Switch {...switchProps('trades')} />} />
          <SettingRow icon="heart-outline" title="Lajkovi i wishlist" description="Reakcije na tvoje artikle." right={<Switch {...switchProps('likes')} />} />
          <SettingRow icon="person-add-outline" title="Novi pratioci" right={<Switch {...switchProps('follows')} />} />
          <SettingRow icon="star-outline" title="Ocene" description="Nova ocena posle razmene." right={<Switch {...switchProps('ratings')} />} />
          <SettingRow icon="sparkles-outline" title="Velve novosti" description="Produkt novosti i retke preporuke." right={<Switch {...switchProps('marketing')} />} />
        </SettingsSection>

        <SettingsSection title="Privatnost i sigurnost">
          <SettingRow
            icon="people-outline"
            title="Pratioci i pracenje"
            description="Upravljaj listom ljudi koje pratis i ukloni pratioce."
            onPress={() =>
              router.push({
                pathname: '/connections',
                params: { userId: dbUser?._id || '', tab: 'followers' },
              })
            }
          />
          <SettingRow
            icon="ban-outline"
            title="Blokirani korisnici"
            description="Pregledaj i deblokiraj korisnike."
            onPress={() => router.push('/blocked-users')}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            title="Sakrij i prijavi"
            description="Na profilu ili artiklu koristi meni sa tri tacke za blokiranje i prijavu."
          />
        </SettingsSection>

        <SettingsSection title="Podrska i pravila">
          <SettingRow
            icon="help-circle-outline"
            title="Kontakt podrske"
            description="Prijavi problem sa nalogom, trade-om ili uploudom."
            onPress={() => openExternal('mailto:support@velveapp.com?subject=Velve%20support')}
          />
          <SettingRow
            icon="document-text-outline"
            title="Uslovi koriscenja"
            onPress={() => openExternal('https://velve.app/terms')}
          />
          <SettingRow
            icon="lock-closed-outline"
            title="Politika privatnosti"
            onPress={() => openExternal('https://velve.app/privacy')}
          />
        </SettingsSection>

        <TouchableOpacity
          className="mt-6 items-center rounded-[24px] border border-signal-danger/20 bg-signal-danger/10 px-5 py-4"
          onPress={handleLogout}
        >
          <Text className="font-sans text-sm font-semibold text-signal-danger">Odjavi se</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
