import { Ionicons } from '@expo/vector-icons'
import { Alert } from '@/lib/velveAlert'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'
import { getApiErrorMessage } from '@/lib/apiErrors'
import { showVelveToast } from '@/lib/velveAlert'

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
  const { locale, localeLabels, locales, setLocale, t } = useI18n()
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [loadingPreferences, setLoadingPreferences] = useState(true)
  const [savingPreference, setSavingPreference] = useState<keyof NotificationPreferences | null>(null)
  const [savingLocale, setSavingLocale] = useState(false)
  const [preferencesNotice, setPreferencesNotice] = useState('')

  const loadPreferences = useCallback(async () => {
    try {
      const response = await client.get('/api/users/me/notification-preferences')
      if (response.data.ok) {
        setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(response.data.data || {}) })
        setPreferencesNotice('')
      }
    } catch (error) {
      // Keep local defaults if the API is temporarily unavailable.
      setPreferencesNotice(getApiErrorMessage(error, t('settings.preferencesLoadError')))
    } finally {
      setLoadingPreferences(false)
    }
  }, [t])

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
          } catch (error) {
            showVelveToast({
              title: t('common.error'),
              message: getApiErrorMessage(error, t('settings.logoutError')),
              tone: 'error',
            })
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
          setPreferencesNotice('')
        }
      } catch (error) {
        setPreferences(previous)
        showVelveToast({
          title: t('common.error'),
          message: getApiErrorMessage(error, t('settings.preferencesSaveError')),
          tone: 'error',
        })
      } finally {
        setSavingPreference(null)
      }
    },
    [preferences, t]
  )

  const openExternal = (url: string) => {
    Linking.openURL(url).catch((error) =>
      showVelveToast({
        title: t('common.error'),
        message: getApiErrorMessage(error, t('settings.linkError')),
        tone: 'error',
      })
    )
  }

  const changeLocale = useCallback(
    async (language: typeof locales[number]) => {
      if (locale === language || savingLocale) return

      try {
        setSavingLocale(true)
        await setLocale(language)
        showVelveToast({
          title: t('settings.languageUpdatedTitle'),
          message: t('settings.languageUpdatedDescription', { language: localeLabels[language] }),
          tone: 'success',
        })
      } catch (error) {
        showVelveToast({
          title: t('common.error'),
          message: getApiErrorMessage(error, t('settings.languageSaveError')),
          tone: 'error',
        })
      } finally {
        setSavingLocale(false)
      }
    },
    [locale, savingLocale, setLocale, t]
  )

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
          {t('settings.accountEyebrow')}
        </Text>
        <Text className="mt-1 font-display text-4xl text-ink-dark">{t('settings.title')}</Text>

        <SettingsSection title={t('settings.account')}>
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
                {dbUser?.displayName || t('settings.defaultUser')}
              </Text>
              <Text className="mt-1 font-sans text-xs text-ink-dark/50">
                {dbUser?.email || t('settings.profileTrust')}
              </Text>
            </View>
          </View>
          <SettingRow
            icon="person-circle-outline"
            title={t('settings.openProfile')}
            description={t('settings.openProfileDescription')}
            onPress={() => router.push('/(tabs)/profile')}
          />
          <SettingRow
            icon="archive-outline"
            title={t('settings.tradeArchive')}
            description={t('settings.tradeArchiveDescription')}
            onPress={() => router.push('/trade-archive')}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.language')}>
          <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/60">
            {t('settings.currentLanguage', { language: localeLabels[locale] })}
          </Text>
          <View className="mt-4 flex-row gap-3">
            {locales.map((language) => {
              const isActive = locale === language
              return (
                <TouchableOpacity
                  key={language}
                  disabled={savingLocale}
                  className={`flex-1 items-center rounded-full px-4 py-3 ${
                    isActive ? 'bg-brand-accent-deep' : 'border border-ink-dark/10 bg-base-canvas'
                  }`}
                  onPress={() => changeLocale(language)}
                >
                  <Text className={`font-sans text-sm font-semibold ${isActive ? 'text-base-canvas' : 'text-ink-dark'}`}>
                    {localeLabels[language]}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </SettingsSection>

        <SettingsSection title={t('settings.pushNotifications')}>
          {loadingPreferences ? (
            <View className="items-center py-5">
              <ActivityIndicator size="small" color={colors.accentDeep} />
            </View>
          ) : null}
          {!loadingPreferences && preferencesNotice ? (
            <View className="mt-3 rounded-[18px] bg-brand-highlight/25 px-4 py-3">
              <Text className="font-sans text-sm leading-6 text-ink-dark/75">
                {preferencesNotice}
              </Text>
              <TouchableOpacity
                className="mt-2 self-start rounded-full bg-base-canvas px-3 py-2"
                onPress={loadPreferences}
              >
                <Text className="font-sans text-xs font-semibold text-ink-dark">
                  {t('common.retry')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <SettingRow icon="notifications-outline" title={t('settings.allPush')} right={<Switch {...switchProps('allPush')} />} />
          <SettingRow icon="chatbubble-outline" title={t('settings.messages')} description={t('settings.messagesDescription')} right={<Switch {...switchProps('messages')} />} />
          <SettingRow icon="swap-horizontal-outline" title={t('settings.trades')} description={t('settings.tradesDescription')} right={<Switch {...switchProps('trades')} />} />
          <SettingRow icon="heart-outline" title={t('settings.likes')} description={t('settings.likesDescription')} right={<Switch {...switchProps('likes')} />} />
          <SettingRow icon="person-add-outline" title={t('settings.follows')} right={<Switch {...switchProps('follows')} />} />
          <SettingRow icon="star-outline" title={t('settings.ratings')} description={t('settings.ratingsDescription')} right={<Switch {...switchProps('ratings')} />} />
          <SettingRow icon="sparkles-outline" title={t('settings.marketing')} description={t('settings.marketingDescription')} right={<Switch {...switchProps('marketing')} />} />
        </SettingsSection>

        <SettingsSection title={t('settings.privacy')}>
          <SettingRow
            icon="people-outline"
            title={t('settings.connections')}
            description={t('settings.connectionsDescription')}
            onPress={() =>
              router.push({
                pathname: '/connections',
                params: { userId: dbUser?._id || '', tab: 'followers' },
              })
            }
          />
          <SettingRow
            icon="ban-outline"
            title={t('settings.blockedUsers')}
            description={t('settings.blockedUsersDescription')}
            onPress={() => router.push('/blocked-users')}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            title={t('settings.hideReport')}
            description={t('settings.hideReportDescription')}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.supportRules')}>
          <SettingRow
            icon="help-circle-outline"
            title={t('settings.support')}
            description={t('settings.supportDescription')}
            onPress={() => openExternal('mailto:info@velveapp.com?subject=Velve%20support')}
          />
          <SettingRow
            icon="document-text-outline"
            title={t('settings.terms')}
            onPress={() => openExternal('https://velve.app/terms')}
          />
          <SettingRow
            icon="lock-closed-outline"
            title={t('settings.privacyPolicy')}
            onPress={() => openExternal('https://velve.app/privacy')}
          />
        </SettingsSection>

        <TouchableOpacity
          className="mt-6 items-center rounded-[24px] border border-signal-danger/20 bg-signal-danger/10 px-5 py-4"
          onPress={handleLogout}
        >
          <Text className="font-sans text-sm font-semibold text-signal-danger">{t('profile.logout')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
