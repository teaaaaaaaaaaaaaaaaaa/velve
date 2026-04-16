import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { ChatSkeleton } from '@/components/BrandedLoader'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'
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
  if (status === 'accepted') return 'Prihvaceno'
  if (status === 'pending') return 'Ceka odgovor'
  if (status === 'rejected') return 'Odbijeno'
  if (status === 'cancelled') return 'Otkazano'
  if (status === 'expired') return 'Isteklo'
  return null
}

const ChatRow = memo(function ChatRow({
  chat,
  other,
  tradeLabel,
  onPress,
}: {
  chat: ChatRoom
  other: Participant | undefined
  tradeLabel: string | null
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      className="mb-1 flex-row items-center px-4 py-3"
    >
      <View className="mr-3">
        {other?.photoURL ? (
          <RemoteImage
            uri={other.photoURL}
            className="h-12 w-12 rounded-full"
            fallback={
              <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-accent-light/40">
                <Text className="font-display text-xl text-brand-accent-deep">
                  {(other?.displayName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            }
          />
        ) : (
          <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-accent-light/40">
            <Text className="font-display text-xl text-brand-accent-deep">
              {(other?.displayName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-sans text-sm font-semibold text-ink-dark" numberOfLines={1}>
            {other?.displayName || other?.email?.split('@')[0] || 'Korisnik'}
          </Text>
          <Text className="ml-2 font-sans text-xs text-ink-dark/40">
            {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : ''}
          </Text>
        </View>

        <View className="mt-0.5 flex-row items-center gap-2">
          <Text className="flex-1 font-sans text-sm text-ink-dark/55" numberOfLines={1}>
            {chat.lastMessage?.text || 'Zapocni razgovor...'}
          </Text>
          {tradeLabel ? (
            <View className="rounded-full bg-brand-accent-light/25 px-2 py-0.5">
              <Text className="font-sans text-[10px] font-semibold text-brand-accent-deep">
                {tradeLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  )
})

export default function ChatListScreen() {
  const router = useRouter()
  const { dbUser } = useAuth()
  const { t } = useI18n()

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

  const getOtherParticipant = useCallback(
    (participants: Participant[]) => {
      if (!dbUser) return participants[0]
      return participants.find((participant) => participant._id !== dbUser._id) || participants[0]
    },
    [dbUser]
  )

  const renderChatItem = useCallback(
    ({ item: chat, index }: { item: ChatRoom; index: number }) => {
      const other = getOtherParticipant(chat.participants)
      const tradeLabel = getTradeLabel(chat.tradeRequestId?.status)

      return (
        <View>
          <ChatRow
            chat={chat}
            other={other}
            tradeLabel={tradeLabel}
            onPress={() => router.push(`/(tabs)/chat/${chat._id}`)}
          />
          {index < chats.length - 1 ? <View className="mx-4 h-px bg-ink-dark/6" /> : null}
        </View>
      )
    },
    [chats.length, getOtherParticipant, router]
  )

  const chatListHeader = useMemo(
    () => (
      <View className="px-5 pb-4 pt-14">
        <BrandBackground />
        <View className="mb-5 flex-row items-end">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-1 mr-3 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
          >
            <Ionicons name="arrow-back" size={22} color={colors.inkDark} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
              {t('chat.eyebrow')}
            </Text>
            <Text className="font-display text-4xl text-ink-dark">{t('chat.title')}</Text>
          </View>
        </View>
      </View>
    ),
    [t, router]
  )

  if (loading) {
    return <ChatSkeleton />
  }

  return (
    <FlatList
      className="flex-1 bg-base-canvas"
      data={chats}
      keyExtractor={(item) => item._id}
      renderItem={renderChatItem}
      ListHeaderComponent={chatListHeader}
      ListEmptyComponent={
        <View className="px-5">
          <EditorialEmptyState
            icon="chatbubbles-outline"
            title={t('chat.emptyTitle')}
            description={t('chat.emptyDescription')}
          />
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={chats.length > 0 ? { paddingBottom: 120 } : { paddingBottom: 120, flexGrow: 1 }}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={5}
      removeClippedSubviews
    />
  )
}
