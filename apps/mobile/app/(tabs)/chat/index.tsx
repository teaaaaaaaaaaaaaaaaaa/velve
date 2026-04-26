import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { ChatSkeleton } from '@/components/BrandedLoader'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'
import { useAuth } from '@/hooks/useAuth'
import { useSocket } from '@/hooks/useSocket'
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
  unreadCount?: number
  updatedAt: string
}

type TradeUser = {
  _id: string
  displayName: string
  photoURL?: string
  averageRating?: number
  completedTrades?: number
}

type TradeItem = {
  _id: string
  title: string
  primaryImage?: string
  images?: string[]
}

type TradeRecord = {
  _id: string
  kind: 'trade' | 'buy'
  userRole: 'sender' | 'receiver'
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired'
  bucket: 'pending' | 'active' | 'history'
  counterpart: TradeUser
  offeredItemId?: TradeItem | null
  requestedItemId?: TradeItem | null
  offeredPrice?: number | null
  updatedAt: string
  createdAt: string
  canAccept: boolean
  canReject: boolean
  canCancel: boolean
  canComplete: boolean
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

function getTradeItemImage(item?: TradeItem | null) {
  return item?.primaryImage || item?.images?.[0] || undefined
}

const ChatRow = memo(function ChatRow({
  chat,
  other,
  tradeLabel,
  onPress,
  onDelete,
}: {
  chat: ChatRoom
  other: Participant | undefined
  tradeLabel: string | null
  onPress: () => void
  onDelete: () => void
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      onLongPress={onDelete}
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
          {chat.unreadCount ? (
            <View className="min-w-5 items-center rounded-full bg-brand-accent-deep px-1.5 py-0.5">
              <Text className="font-sans text-[10px] font-semibold text-base-canvas">
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </Text>
            </View>
          ) : tradeLabel ? (
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

const TradeRow = memo(function TradeRow({
  trade,
  busy,
  onAccept,
  onReject,
  onCancel,
  onComplete,
}: {
  trade: TradeRecord
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onCancel: () => void
  onComplete: () => void
}) {
  const tradeLabel = getTradeLabel(trade.status)
  const statusTone =
    trade.status === 'pending'
      ? 'bg-brand-highlight/35 text-ink-dark'
      : trade.status === 'accepted'
        ? 'bg-brand-accent-light/28 text-brand-accent-deep'
        : 'bg-ink-dark/8 text-ink-dark/60'

  return (
    <View className="mb-3 rounded-[26px] bg-surface-panel px-4 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          {trade.counterpart?.photoURL ? (
            <RemoteImage uri={trade.counterpart.photoURL} className="h-11 w-11 rounded-full" />
          ) : (
            <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-accent-light/40">
              <Text className="font-display text-xl text-brand-accent-deep">
                {(trade.counterpart?.displayName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View className="ml-3">
            <Text className="font-sans text-sm font-semibold text-ink-dark">
              {trade.counterpart?.displayName || 'Korisnik'}
            </Text>
            <Text className="font-sans text-xs text-ink-dark/45">
              {trade.kind === 'buy' ? 'Kupovina' : 'Razmena'} · {formatTime(trade.updatedAt)}
            </Text>
          </View>
        </View>

        {tradeLabel ? (
          <View className={`rounded-full px-3 py-1.5 ${statusTone}`}>
            <Text className="font-sans text-[11px] font-semibold">{tradeLabel}</Text>
          </View>
        ) : null}
      </View>

      <View className="mt-4 flex-row items-start gap-3">
        {trade.offeredItemId ? (
          <>
            <View className="flex-1">
              <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/40">
                Nudi
              </Text>
              <View className="mt-2 overflow-hidden rounded-[18px] bg-base-canvas">
                {getTradeItemImage(trade.offeredItemId) ? (
                  <RemoteImage
                    uri={getTradeItemImage(trade.offeredItemId)}
                    className="aspect-square w-full"
                  />
                ) : (
                  <View className="aspect-square w-full items-center justify-center bg-brand-accent-light/20">
                    <Ionicons name="shirt-outline" size={22} color={colors.accentDeep} />
                  </View>
                )}
              </View>
              <Text className="mt-2 font-sans text-sm font-semibold text-ink-dark" numberOfLines={2}>
                {trade.offeredItemId.title}
              </Text>
            </View>

            <View className="mt-12 h-10 w-10 items-center justify-center rounded-full bg-brand-accent-deep/8">
              <Ionicons name="swap-horizontal" size={18} color={colors.accentDeep} />
            </View>
          </>
        ) : null}

        <View className="flex-1">
          <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/40">
            {trade.kind === 'buy' ? 'Trazi da kupi' : 'Trazi'}
          </Text>
          <View className="mt-2 overflow-hidden rounded-[18px] bg-base-canvas">
            {getTradeItemImage(trade.requestedItemId) ? (
              <RemoteImage
                uri={getTradeItemImage(trade.requestedItemId)}
                className="aspect-square w-full"
              />
            ) : (
              <View className="aspect-square w-full items-center justify-center bg-brand-accent-light/20">
                <Ionicons name="shirt-outline" size={22} color={colors.accentDeep} />
              </View>
            )}
          </View>
          <Text className="mt-2 font-sans text-sm font-semibold text-ink-dark" numberOfLines={2}>
            {trade.requestedItemId?.title || 'Predmet'}
          </Text>
          {trade.kind === 'buy' && trade.offeredPrice != null ? (
            <Text className="mt-1 font-sans text-xs text-brand-accent-deep">
              Ponuda {trade.offeredPrice} EUR
            </Text>
          ) : null}
        </View>
      </View>

      {trade.canAccept || trade.canReject || trade.canCancel || trade.canComplete ? (
        <View className="mt-4 flex-row flex-wrap gap-2">
          {trade.canAccept ? (
            <TouchableOpacity
              onPress={onAccept}
              disabled={busy}
              className="items-center rounded-full bg-brand-accent-deep px-4 py-3"
            >
              <Text className="font-sans text-sm font-semibold text-base-canvas">
                {busy ? '...' : 'Prihvati'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {trade.canReject ? (
            <TouchableOpacity
              onPress={onReject}
              disabled={busy}
              className="items-center rounded-full bg-base-canvas px-4 py-3"
            >
              <Text className="font-sans text-sm font-semibold text-ink-dark">
                {busy ? '...' : 'Odbij'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {trade.canCancel ? (
            <TouchableOpacity
              onPress={onCancel}
              disabled={busy}
              className="items-center rounded-full bg-base-canvas px-4 py-3"
            >
              <Text className="font-sans text-sm font-semibold text-ink-dark/70">
                {busy ? '...' : 'Otkazi'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {trade.canComplete ? (
            <TouchableOpacity
              onPress={onComplete}
              disabled={busy}
              className="items-center rounded-full bg-brand-highlight px-4 py-3"
            >
              <Text className="font-sans text-sm font-semibold text-ink-dark">
                {busy ? '...' : 'Zavrsi trade'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  )
})

export default function ChatListScreen() {
  const router = useRouter()
  const { dbUser } = useAuth()
  const { socket } = useSocket()
  const { t } = useI18n()

  const [activeTab, setActiveTab] = useState<'messages' | 'trades'>('messages')
  const [chats, setChats] = useState<ChatRoom[]>([])
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tradeActionId, setTradeActionId] = useState<string | null>(null)

  const fetchChats = useCallback(async () => {
    const response = await client.get('/api/chat')
    if (response.data.ok) {
      setChats(response.data.data as ChatRoom[])
    }
  }, [])

  const fetchTrades = useCallback(async () => {
    const response = await client.get('/api/trades')
    if (response.data.ok) {
      const nextTrades = (response.data.data as TradeRecord[])
        .filter((trade) => trade.bucket !== 'history')
        .sort((a, b) => {
          const priorityA = a.bucket === 'pending' ? 0 : 1
          const priorityB = b.bucket === 'pending' ? 0 : 1
          if (priorityA !== priorityB) return priorityA - priorityB
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        })

      setTrades(nextTrades)
    }
  }, [])

  const loadAll = useCallback(async () => {
    await Promise.all([fetchChats(), fetchTrades()])
  }, [fetchChats, fetchTrades])

  useEffect(() => {
    loadAll()
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [loadAll])

  useEffect(() => {
    if (!socket) return

    const refreshChats = () => {
      fetchChats().catch(() => undefined)
    }
    const removeDeletedChat = ({ chatId }: { chatId: string }) => {
      setChats((prev) => prev.filter((chat) => chat._id !== chatId))
    }

    socket.on('chat_updated', refreshChats)
    socket.on('badge_new_message', refreshChats)
    socket.on('chat_deleted', removeDeletedChat)

    return () => {
      socket.off('chat_updated', refreshChats)
      socket.off('badge_new_message', refreshChats)
      socket.off('chat_deleted', removeDeletedChat)
    }
  }, [fetchChats, socket])

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true)
      await loadAll()
    } finally {
      setRefreshing(false)
    }
  }, [loadAll])

  const getOtherParticipant = useCallback(
    (participants: Participant[]) => {
      if (!dbUser) return participants[0]
      return participants.find((participant) => participant._id !== dbUser._id) || participants[0]
    },
    [dbUser]
  )

  const runTradeAction = useCallback(
    async (
      tradeId: string,
      action: 'accept' | 'reject' | 'cancel' | 'complete'
    ) => {
      try {
        setTradeActionId(tradeId)

        if (action === 'accept') {
          await client.put(`/api/trades/${tradeId}`, { status: 'accepted' })
        } else if (action === 'reject') {
          await client.put(`/api/trades/${tradeId}`, { status: 'rejected' })
        } else if (action === 'cancel') {
          await client.post(`/api/trades/${tradeId}/cancel`, {})
        } else {
          await client.put(`/api/trades/${tradeId}/complete`, {})
        }

        await loadAll()
      } finally {
        setTradeActionId(null)
      }
    },
    [loadAll]
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
            onDelete={() => {
              Alert.alert('Obrisi razgovor?', 'Razgovor se brise samo kod tebe.', [
                { text: 'Odustani', style: 'cancel' },
                {
                  text: 'Obrisi',
                  style: 'destructive',
                  onPress: async () => {
                    setChats((prev) => prev.filter((entry) => entry._id !== chat._id))
                    await client.delete(`/api/chat/${chat._id}`).catch(() => fetchChats())
                  },
                },
              ])
            }}
          />
          {index < chats.length - 1 ? <View className="mx-4 h-px bg-ink-dark/6" /> : null}
        </View>
      )
    },
    [chats.length, getOtherParticipant, router]
  )

  const messageCount = chats.length
  const pendingTradeCount = trades.filter((trade) => trade.bucket === 'pending').length

  const topHeader = useMemo(
    () => (
      <View className="px-5 pb-4 pt-14">
        <BrandBackground />
        <View className="mb-5">
          <Text className="font-sans text-xs uppercase tracking-[1.4px] text-ink-dark/45">
            {t('chat.eyebrow')}
          </Text>
          <Text className="font-display text-4xl text-ink-dark">{t('chat.title')}</Text>
        </View>

        <View className="flex-row rounded-[22px] bg-surface-panel p-1">
          <TouchableOpacity
            onPress={() => setActiveTab('messages')}
            className={`flex-1 rounded-[18px] px-4 py-3 ${
              activeTab === 'messages' ? 'bg-brand-accent-deep' : ''
            }`}
          >
            <Text
              className={`text-center font-sans text-sm font-semibold ${
                activeTab === 'messages' ? 'text-base-canvas' : 'text-ink-dark/60'
              }`}
            >
              Poruke {messageCount > 0 ? `(${messageCount})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('trades')}
            className={`flex-1 rounded-[18px] px-4 py-3 ${
              activeTab === 'trades' ? 'bg-brand-accent-deep' : ''
            }`}
          >
            <Text
              className={`text-center font-sans text-sm font-semibold ${
                activeTab === 'trades' ? 'text-base-canvas' : 'text-ink-dark/60'
              }`}
            >
              Tradeovi {pendingTradeCount > 0 ? `(${pendingTradeCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [activeTab, messageCount, pendingTradeCount, router, t]
  )

  if (loading) {
    return <ChatSkeleton />
  }

  if (activeTab === 'messages') {
    return (
      <FlatList
        className="flex-1 bg-base-canvas"
        data={chats}
        keyExtractor={(item) => item._id}
        renderItem={renderChatItem}
        ListHeaderComponent={topHeader}
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
        contentContainerStyle={
          chats.length > 0 ? { paddingBottom: 120 } : { paddingBottom: 120, flexGrow: 1 }
        }
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
      />
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-base-canvas"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      {topHeader}

      <View className="px-5">
        {trades.length === 0 ? (
          <EditorialEmptyState
            icon="swap-horizontal-outline"
            title="Nema aktivnih tradeova"
            description="Ovde ce prvo iskakati novi zahtevi koji cekaju odgovor, pa tek onda prihvaceni tokovi."
          />
        ) : (
          trades.map((trade) => (
            <TradeRow
              key={trade._id}
              trade={trade}
              busy={tradeActionId === trade._id}
              onAccept={() => runTradeAction(trade._id, 'accept')}
              onReject={() => runTradeAction(trade._id, 'reject')}
              onCancel={() => runTradeAction(trade._id, 'cancel')}
              onComplete={() => runTradeAction(trade._id, 'complete')}
            />
          ))
        )}

        {tradeActionId ? (
          <View className="pt-2">
            <ActivityIndicator color={colors.accentDeep} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  )
}
