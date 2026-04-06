import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import client from '@/api/client'
import { ChatSkeleton } from '@/components/BrandedLoader'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'
import { BrandBackground } from '@/components/BrandBackground'
import { BrandWordmark } from '@/components/BrandWordmark'
import { colors } from '@/design/tokens'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'

type Participant = {
  _id: string
  displayName: string
  photoURL?: string
  email?: string
}

type TradeMeta = {
  _id: string
  status: string
}

type LastMessage = {
  _id: string
  text: string
  senderId?: { _id: string; displayName: string }
  createdAt: string
}

type ChatRoom = {
  _id: string
  participants: Participant[]
  tradeRequestId?: TradeMeta | null
  lastMessage: LastMessage | null
  messageCount: number
  updatedAt: string
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Sad'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('sr-Latn', { day: 'numeric', month: 'short' })
}

function getTradeLabel(status?: string | null) {
  if (status === 'accepted') return 'Active trade'
  if (status === 'pending') return 'Pending trade'
  if (status === 'rejected') return 'Declined'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'expired') return 'Expired'
  return null
}

export default function ChatListScreen() {
  const router = useRouter()
  const { dbUser } = useAuth()
  const { t, locale } = useI18n()

  const [chats, setChats] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchChats = useCallback(async () => {
    const response = await client.get('/api/chat')
    if (response.data.ok) {
      setChats(response.data.data as ChatRoom[])
    }
  }, [])

  useEffect(() => {
    fetchChats()
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [fetchChats])

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true)
      await fetchChats()
    } finally {
      setRefreshing(false)
    }
  }, [fetchChats])

  const summary = useMemo(() => {
    return {
      active: chats.filter((chat) => chat.tradeRequestId?.status === 'accepted').length,
      pending: chats.filter((chat) => chat.tradeRequestId?.status === 'pending').length,
    }
  }, [chats])

  const getOtherParticipant = useCallback(
    (participants: Participant[]) => {
      if (!dbUser) return participants[0]
      return participants.find((participant) => participant._id !== dbUser._id) || participants[0]
    },
    [dbUser]
  )

  if (loading) {
    return <ChatSkeleton />
  }

  return (
    <ScrollView
      className="flex-1 bg-base-canvas"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <BrandBackground />
      <View className="px-5 pb-8 pt-14">
        <View className="mb-5 flex-row items-end justify-between">
          <View className="flex-1 pr-4">
            <BrandWordmark width={110} />
            <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
              {t('chat.eyebrow')}
            </Text>
            <Text className="font-display text-4xl text-ink-dark">{t('chat.title')}</Text>
          </View>

          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-full bg-white"
            onPress={() => router.push('/(tabs)/trades')}
          >
              <Ionicons name="swap-horizontal" size={20} color={colors.accentDeep} />
            </TouchableOpacity>
        </View>

        <View className="mb-6 overflow-hidden rounded-[28px] border border-brand-accent-deep/10 bg-white px-4 py-4">
          <Text className="font-display text-2xl text-ink-dark">{t('chat.tradePulse')}</Text>
          <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/65">
            Aktivni i pending trade razgovori ostaju uz chat, ali puni lifecycle sada imas u
            posebnom trade desk ekranu.
          </Text>

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-[22px] bg-base-canvas px-4 py-4">
              <Text className="font-sans text-[11px] uppercase tracking-[1.2px] text-ink-dark/45">
                Pending
              </Text>
              <Text className="mt-1 font-display text-3xl text-ink-dark">{summary.pending}</Text>
            </View>
            <View className="flex-1 rounded-[22px] bg-base-canvas px-4 py-4">
              <Text className="font-sans text-[11px] uppercase tracking-[1.2px] text-ink-dark/45">
                Active
              </Text>
              <Text className="mt-1 font-display text-3xl text-ink-dark">{summary.active}</Text>
            </View>
          </View>

          <TouchableOpacity
            className="mt-4 items-center rounded-full bg-brand-accent-deep px-4 py-3"
            onPress={() => router.push('/(tabs)/trades')}
          >
            <Text className="font-sans text-sm font-semibold text-base-canvas">
              {t('chat.openTradeDesk')}
            </Text>
          </TouchableOpacity>
        </View>

        {chats.length === 0 ? (
          <EditorialEmptyState
            icon="chatbubbles-outline"
            title={t('chat.emptyTitle')}
            description={t('chat.emptyDescription')}
          />
        ) : (
          chats.map((chat) => {
            const other = getOtherParticipant(chat.participants)
            const tradeLabel = getTradeLabel(chat.tradeRequestId?.status)

            return (
              <TouchableOpacity
                key={chat._id}
                activeOpacity={0.88}
                onPress={() => router.push(`/(tabs)/chat/${chat._id}`)}
                className="mb-4 overflow-hidden rounded-[28px] border border-ink-dark/8 bg-white px-4 py-4"
              >
                <View className="flex-row items-center">
                  {other?.photoURL ? (
                    <RemoteImage
                      uri={other.photoURL}
                      className="h-14 w-14 rounded-full"
                      fallback={
                        <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-light/35">
                          <Text className="font-display text-2xl text-brand-accent-deep">
                            {(other?.displayName || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      }
                    />
                  ) : (
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-accent-light/35">
                      <Text className="font-display text-2xl text-brand-accent-deep">
                        {(other?.displayName || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View className="ml-4 flex-1 pr-4">
                    <Text className="font-display text-2xl text-ink-dark" numberOfLines={1}>
                      {other?.displayName || other?.email?.split('@')[0] || 'Korisnik'}
                    </Text>
                    <Text className="mt-1 font-sans text-sm text-ink-dark/60" numberOfLines={2}>
                      {chat.lastMessage?.text || 'Započni razgovor i zatim ga vodi kroz uredan trade lifecycle.'}
                    </Text>
                  </View>

                    <Text className="font-sans text-xs text-ink-dark/40">
                    {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : ''}
                  </Text>
                </View>

                <View className="mt-4 flex-row flex-wrap gap-2">
                  <View className="rounded-full bg-base-canvas px-3 py-2">
                    <Text className="font-sans text-xs text-ink-dark/70">
                      {chat.messageCount} poruka
                    </Text>
                  </View>

                  {tradeLabel ? (
                    <View className="rounded-full bg-brand-accent-light/25 px-3 py-2">
                      <Text className="font-sans text-xs font-semibold text-brand-accent-deep">
                        {tradeLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </View>
    </ScrollView>
  )
}
