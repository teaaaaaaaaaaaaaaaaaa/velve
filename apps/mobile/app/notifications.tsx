import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { getApiErrorMessage } from '@/lib/apiErrors'

type NotificationRecord = {
  _id: string
  type: string
  title: string
  body?: string
  readAt?: string | null
  createdAt: string
  actorUserId?: { _id: string; displayName?: string; photoURL?: string }
  itemId?: { _id: string; title?: string; images?: string[]; imageClean?: string | null; primaryImage?: string | null }
  tradeId?: string
  chatId?: string
  data?: Record<string, string>
}

function formatTime(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Sad'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function isToday(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  return date.toDateString() === now.toDateString()
}

function getIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type.includes('like')) return 'heart-outline'
  if (type.includes('wishlist')) return 'bookmark-outline'
  if (type.includes('follow')) return 'person-add-outline'
  if (type.includes('chat')) return 'chatbubble-outline'
  if (type.includes('trade')) return 'swap-horizontal-outline'
  return 'sparkles-outline'
}

export default function NotificationsScreen() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const grouped = useMemo(
    () => ({
      today: notifications.filter((entry) => isToday(entry.createdAt)),
      earlier: notifications.filter((entry) => !isToday(entry.createdAt)),
    }),
    [notifications]
  )

  const loadNotifications = useCallback(async () => {
    try {
      const response = await client.get('/api/notifications')
      if (response.data.ok) {
        setNotifications(response.data.data || [])
        setErrorMessage('')
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Notifikacije trenutno nisu dostupne.'))
    }
  }, [])

  useEffect(() => {
    loadNotifications().finally(() => setLoading(false))
  }, [loadNotifications])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadNotifications()
    setRefreshing(false)
  }, [loadNotifications])

  const markAllRead = useCallback(async () => {
    await client.put('/api/notifications/read').catch(() => undefined)
    setNotifications((prev) => prev.map((entry) => ({ ...entry, readAt: entry.readAt || new Date().toISOString() })))
  }, [])

  const openNotification = useCallback(
    async (notification: NotificationRecord) => {
      client.put(`/api/notifications/${notification._id}/read`).catch(() => undefined)
      setNotifications((prev) =>
        prev.map((entry) =>
          entry._id === notification._id ? { ...entry, readAt: entry.readAt || new Date().toISOString() } : entry
        )
      )

      const chatId = notification.chatId || notification.data?.chatId
      const itemId = notification.itemId?._id || notification.data?.itemId
      const actorId = notification.actorUserId?._id || notification.data?.userId || notification.data?.senderId
      const tradeId = notification.tradeId || notification.data?.tradeId

      if (chatId) {
        router.push(`/(tabs)/chat/${chatId}`)
      } else if (itemId) {
        router.push(`/items/${itemId}`)
      } else if (notification.type === 'trade_rating' && tradeId) {
        router.push('/trade-archive')
      } else if (actorId) {
        router.push(`/users/${actorId}`)
      }
    },
    [router]
  )

  const renderGroup = (title: string, entries: NotificationRecord[]) => {
    if (entries.length === 0) return null

    return (
      <View className="mt-5">
        <Text className="mb-3 font-sans text-xs uppercase tracking-[1.2px] text-ink-dark/45">
          {title}
        </Text>
        <View className="gap-3">
          {entries.map((notification) => {
            const imageUri =
              notification.actorUserId?.photoURL ||
              notification.itemId?.primaryImage ||
              notification.itemId?.imageClean ||
              notification.itemId?.images?.[0]
            return (
              <TouchableOpacity
                key={notification._id}
                activeOpacity={0.88}
                onPress={() => openNotification(notification)}
                className="flex-row items-center rounded-[24px] bg-surface-panel px-4 py-4"
              >
                <View className="mr-3 h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-brand-accent-light/25">
                  {imageUri ? (
                    <RemoteImage uri={imageUri} className="h-full w-full" />
                  ) : (
                    <Ionicons name={getIcon(notification.type)} size={20} color={colors.accentDeep} />
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    {!notification.readAt ? (
                      <View className="mr-2 h-2 w-2 rounded-full bg-brand-highlight" />
                    ) : null}
                    <Text className="flex-1 font-sans text-sm font-semibold text-ink-dark">
                      {notification.title}
                    </Text>
                    <Text className="ml-2 font-sans text-xs text-ink-dark/35">
                      {formatTime(notification.createdAt)}
                    </Text>
                  </View>
                  {notification.body ? (
                    <Text className="mt-1 font-sans text-sm leading-5 text-ink-dark/60" numberOfLines={2}>
                      {notification.body}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-canvas">
        <ActivityIndicator color={colors.accentDeep} />
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-base-canvas"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <BrandBackground />
      <View className="px-5 pb-8 pt-14">
        <View className="mb-6 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
          </TouchableOpacity>
          <TouchableOpacity onPress={markAllRead} className="rounded-full bg-surface-panel px-4 py-3">
            <Text className="font-sans text-sm font-semibold text-brand-accent-deep">Procitano</Text>
          </TouchableOpacity>
        </View>

        <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
          Velve pulse
        </Text>
        <Text className="mt-1 font-display text-4xl text-ink-dark">Notifikacije</Text>

        {errorMessage ? (
          <View className="mt-8">
            <EditorialEmptyState
              icon="cloud-offline-outline"
              title="Ne mogu da ucitam notifikacije"
              description={errorMessage}
              actionLabel="Pokusaj ponovo"
              onAction={loadNotifications}
            />
          </View>
        ) : notifications.length === 0 ? (
          <View className="mt-8">
            <EditorialEmptyState
              icon="notifications-outline"
              title="Jos nema notifikacija"
              description="Kada neko lajkuje komad, zaprati te ili promeni trade tok, sve ce stizati ovde."
            />
          </View>
        ) : (
          <>
            {renderGroup('Danas', grouped.today)}
            {renderGroup('Ranije', grouped.earlier)}
          </>
        )}
      </View>
    </ScrollView>
  )
}
