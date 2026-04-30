import { Ionicons } from '@expo/vector-icons'
import { Alert } from '@/lib/velveAlert'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { io, Socket } from 'socket.io-client'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { ChatSkeleton } from '@/components/BrandedLoader'
import { KeyboardAwareScreen } from '@/components/KeyboardAwareScreen'
import { RemoteImage } from '@/components/RemoteImage'
import { VelveTextInput } from '@/components/VelveTextInput'
import { colors } from '@/design/tokens'
import { API_URL } from '@/config/api'
import { auth as firebaseAuth, getAuthToken } from '@/config/firebase'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n'

type Participant = {
  _id: string
  displayName: string
  photoURL?: string
  email?: string
}

type TradeData = {
  tradeRequestId?: string
  offeredItemId: string
  offeredItemTitle: string
  offeredItemImage?: string
  requestedItemId: string
  requestedItemTitle: string
  requestedItemImage?: string
}

type BuyData = {
  tradeRequestId?: string
  requestedItemId: string
  requestedItemTitle: string
  requestedItemImage?: string
  offeredPrice?: number
}

type StatusData = {
  tradeRequestId: string
  status: string
  label: string
}

type MessageRecord = {
  _id: string
  clientId?: string
  chatId: string
  senderId: { _id: string; displayName: string; photoURL?: string } | string
  text: string
  type?: 'text' | 'trade' | 'buy' | 'trade_update'
  tradeData?: TradeData
  buyData?: BuyData
  statusData?: StatusData
  createdAt: string
  deliveryStatus?: 'pending' | 'sent' | 'failed'
}

type TradeState = {
  _id: string
  status: string
  senderId: { _id: string } | string
  receiverId: { _id: string } | string
  type?: 'trade' | 'buy'
  offeredPrice?: number | null
}

type ChatPayload = {
  participants: Participant[]
  tradeRequestId?: TradeState | null
  messages: MessageRecord[]
}

function resolveId(value?: { _id: string } | string | null) {
  if (!value) return null
  return typeof value === 'string' ? value : value._id
}

function getDisplayName(participant: Participant | null) {
  if (!participant) return 'Korisnik'
  return participant.displayName || participant.email?.split('@')[0] || 'Korisnik'
}

function getSenderDisplayName(
  message: MessageRecord,
  isMine: boolean,
  otherUser: Participant | null
) {
  if (typeof message.senderId === 'object' && message.senderId?.displayName) {
    return isMine ? 'Ti' : message.senderId.displayName
  }

  return isMine ? 'Ti' : getDisplayName(otherUser)
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('sr-Latn', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (diffDays === 0) return 'Danas'
  if (diffDays === 1) return 'Juce'
  return date.toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long' })
}

function isSameDay(a?: string, b?: string) {
  if (!a || !b) return false
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function createClientMessageId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function mergeIncomingMessage(prev: MessageRecord[], incoming: MessageRecord): MessageRecord[] {
  if (incoming.clientId) {
    const hasClientMatch = prev.some((message) => message.clientId === incoming.clientId)
    if (hasClientMatch) {
      return prev.map((message) =>
        message.clientId === incoming.clientId ? { ...incoming, deliveryStatus: 'sent' } : message
      )
    }
  }

  if (prev.some((message) => message._id === incoming._id)) {
    return prev
  }

  return [...prev, { ...incoming, deliveryStatus: 'sent' }]
}

const ProposalItemCard = memo(function ProposalItemCard({
  title,
  imageUri,
  label,
  eyebrow,
  onPress,
}: {
  title: string
  imageUri?: string
  label: string
  eyebrow: string
  onPress: () => void
}) {
  return (
    <View className="flex-1">
      <Text className="font-sans text-xs font-semibold text-ink-dark/62" numberOfLines={1}>
        {label}
      </Text>
      <Text className="mt-1 font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/40">
        {eyebrow}
      </Text>

      <TouchableOpacity activeOpacity={0.9} onPress={onPress} className="mt-3">
        <View className="overflow-hidden rounded-[18px] bg-base-canvas">
          {imageUri ? (
            <RemoteImage
              uri={imageUri}
              className="aspect-square w-full"
              fallback={
                <View className="aspect-square w-full items-center justify-center bg-brand-accent-light/20">
                  <Ionicons name="shirt-outline" size={24} color={colors.accentDeep} />
                </View>
              }
            />
          ) : (
            <View className="aspect-square w-full items-center justify-center bg-brand-accent-light/20">
              <Ionicons name="shirt-outline" size={24} color={colors.accentDeep} />
            </View>
          )}
        </View>
      </TouchableOpacity>

      <Text className="mt-3 font-sans text-sm font-semibold leading-5 text-ink-dark" numberOfLines={2}>
        {title}
      </Text>
    </View>
  )
})

const ProposalMessageCard = memo(function ProposalMessageCard({
  title,
  tradeData,
  buyData,
  offeredLabel,
  requestedLabel,
  showDecisionActions,
  submittingDecision,
  onOpenOfferedItem,
  onOpenRequestedItem,
  onAccept,
  onReject,
}: {
  title: string
  tradeData?: TradeData
  buyData?: BuyData
  offeredLabel?: string
  requestedLabel?: string
  showDecisionActions?: boolean
  submittingDecision?: boolean
  onOpenOfferedItem?: () => void
  onOpenRequestedItem: () => void
  onAccept?: () => void
  onReject?: () => void
}) {
  return (
    <View
      className="mx-4 my-2 overflow-hidden rounded-[24px] bg-surface-panel px-4 py-4"
      style={{
        shadowColor: colors.accentDeep,
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }}
    >
      <Text className="font-display text-2xl text-ink-dark">{title}</Text>

      {tradeData ? (
        <View className="mt-4 flex-row items-start gap-3">
          <ProposalItemCard
            title={tradeData.offeredItemTitle}
            imageUri={tradeData.offeredItemImage}
            label={offeredLabel || 'Korisnik'}
            eyebrow="Nudi"
            onPress={onOpenOfferedItem || onOpenRequestedItem}
          />
          <View className="mt-16 h-10 w-10 items-center justify-center rounded-full bg-brand-accent-deep/8">
            <Ionicons name="swap-horizontal" size={18} color={colors.accentDeep} />
          </View>
          <ProposalItemCard
            title={tradeData.requestedItemTitle}
            imageUri={tradeData.requestedItemImage}
            label={requestedLabel || 'Predmet'}
            eyebrow="Trazi"
            onPress={onOpenRequestedItem}
          />
        </View>
      ) : buyData ? (
        <View className="mt-4">
          <ProposalItemCard
            title={buyData.requestedItemTitle}
            imageUri={buyData.requestedItemImage}
            label={buyData.offeredPrice != null ? `Ponuda ${buyData.offeredPrice} EUR` : 'Kupovina'}
            eyebrow="Predmet"
            onPress={onOpenRequestedItem}
          />
        </View>
      ) : null}

      {showDecisionActions ? (
        <View className="mt-4 flex-row gap-3">
          <TouchableOpacity
            onPress={onAccept}
            disabled={submittingDecision}
            className="flex-1 items-center rounded-full bg-brand-accent-deep px-4 py-3"
          >
            {submittingDecision ? (
              <ActivityIndicator size="small" color={colors.baseCanvas} />
            ) : (
              <Text className="font-sans text-sm font-semibold text-base-canvas">Prihvati</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onReject}
            disabled={submittingDecision}
            className="flex-1 items-center rounded-full bg-base-canvas px-4 py-3"
            style={{
              shadowColor: colors.inkDark,
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Text className="font-sans text-sm font-semibold text-ink-dark">Odbij</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  )
})

const TradeStatusTicket = memo(function TradeStatusTicket({ statusData }: { statusData: StatusData }) {
  return (
    <View
      className="mx-4 my-2 overflow-hidden rounded-[22px] bg-surface-panel px-4 py-4"
      style={{
        shadowColor: colors.accentDeep,
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-accent-light/25">
          <Ionicons name="sparkles-outline" size={18} color={colors.accentDeep} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/45">
            Status
          </Text>
          <Text className="font-sans text-sm leading-6 text-ink-dark/75">{statusData.label}</Text>
        </View>
      </View>
    </View>
  )
})

export default function ChatScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { dbUser } = useAuth()
  const { t } = useI18n()

  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [submittingDecision, setSubmittingDecision] = useState(false)
  const [otherUser, setOtherUser] = useState<Participant | null>(null)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [tradeRequest, setTradeRequest] = useState<TradeState | null>(null)
  const [composerHeight, setComposerHeight] = useState(86)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const flatListRef = useRef<FlatList<MessageRecord>>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const fetchChat = useCallback(async () => {
    const response = await client.get(`/api/chat/${chatId}`)
    if (response.data.ok) {
      const data = response.data.data as ChatPayload
      setMessages(data.messages || [])
      setTradeRequest(data.tradeRequestId || null)
      client.post(`/api/chat/${chatId}/read`).catch(() => undefined)

      if (data.participants && dbUser) {
        const participant =
          data.participants.find((entry) => entry._id !== dbUser._id) || data.participants[0] || null
        setOtherUser(participant)
      }
    }
  }, [chatId, dbUser])

  useEffect(() => {
    fetchChat()
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [fetchChat])

  useEffect(() => {
    let socket: Socket | null = null

    async function connectSocket() {
      const user = firebaseAuth.currentUser
      if (!user) return

      const token = await getAuthToken(user)
      socket = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      })

      socket.on('connect', () => {
        socket?.emit('join_chat', chatId)
        socket?.emit('mark_read', chatId)
      })

      socket.on('new_message', (payload: { chatId: string; message: MessageRecord }) => {
        if (payload.chatId !== chatId) return

        setMessages((prev) => mergeIncomingMessage(prev, payload.message))

        socket?.emit('mark_read', chatId)
      })

      socket.on('messages_read', (payload: { chatId: string; userId: string; readAt: string }) => {
        if (payload.chatId !== chatId) return
      })

      socket.on('user_typing', (payload: { chatId: string; displayName: string }) => {
        if (payload.chatId !== chatId) return

        setTypingUser(payload.displayName)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000)
      })

      socket.on('message_deleted', (payload: { chatId: string; messageId: string }) => {
        if (payload.chatId !== chatId) return
        setMessages((prev) => prev.filter((message) => message._id !== payload.messageId))
      })

      socketRef.current = socket
    }

    connectSocket().catch(() => undefined)

    return () => {
      if (socket) {
        socket.emit('leave_chat', chatId)
        socket.disconnect()
      }
      socketRef.current = null

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [chatId])

  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if (!text || sending) return

    const clientId = createClientMessageId()
    const optimisticMessage: MessageRecord = {
      _id: clientId,
      clientId,
      chatId,
      senderId: {
        _id: dbUser?._id || '',
        displayName: dbUser?.displayName || 'Ti',
        photoURL: dbUser?.photoURL,
      },
      text,
      type: 'text',
      createdAt: new Date().toISOString(),
      deliveryStatus: 'pending',
    }

    setInputText('')
    setMessages((prev) => [...prev, optimisticMessage])
    setSending(true)

    try {
      let nextMessage: MessageRecord | null = null

      if (socketRef.current?.connected) {
        nextMessage = await new Promise<MessageRecord>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Message acknowledgement timed out')), 10000)

          socketRef.current?.emit(
            'send_message',
            { chatId, text, clientId },
            (ack: { ok: boolean; data?: MessageRecord; error?: string }) => {
              clearTimeout(timeout)
              if (ack.ok && ack.data) {
                resolve(ack.data)
                return
              }
              reject(new Error(ack.error || 'Message send failed'))
            }
          )
        })
      } else {
        const response = await client.post(`/api/chat/${chatId}/message`, { text, clientId })
        if (response.data.ok) {
          nextMessage = response.data.data as MessageRecord
        }
      }

      if (nextMessage) {
        setMessages((prev) =>
          prev.map((message) =>
            message.clientId === clientId ? { ...nextMessage, deliveryStatus: 'sent' } : message
          )
        )
      }
    } catch {
      setMessages((prev) =>
        prev.map((message) =>
          message.clientId === clientId ? { ...message, deliveryStatus: 'failed' } : message
        )
      )
      setInputText(text)
    } finally {
      setSending(false)
    }
  }, [chatId, dbUser?._id, dbUser?.displayName, dbUser?.photoURL, inputText, sending])

  const handleTyping = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', chatId)
    }
  }, [chatId])

  const getSenderId = useCallback((message: MessageRecord) => {
    if (typeof message.senderId === 'object' && message.senderId?._id) {
      return message.senderId._id
    }
    return message.senderId
  }, [])

  const activeTradeId = tradeRequest?._id ? String(tradeRequest._id) : null
  const canRespondToTrade =
    tradeRequest?.status === 'pending' &&
    resolveId(tradeRequest.receiverId) === dbUser?._id

  const handleTradeDecision = useCallback(
    async (status: 'accepted' | 'rejected') => {
      if (!tradeRequest?._id || !canRespondToTrade || submittingDecision) return

      try {
        setSubmittingDecision(true)
        const response = await client.put(`/api/trades/${tradeRequest._id}`, { status })
        if (response.data.ok) {
          setTradeRequest(response.data.data as TradeState)
          await fetchChat()
        }
      } catch {
        // Keep failure quiet inside the thread and let the user retry.
      } finally {
        setSubmittingDecision(false)
      }
    },
    [canRespondToTrade, fetchChat, submittingDecision, tradeRequest?._id]
  )

  const handleRetry = useCallback(
    async (failedMessage: MessageRecord) => {
      const text = failedMessage.text
      if (!text) return

      const clientId = createClientMessageId()
      setMessages((prev) =>
        prev.map((m) =>
          m._id === failedMessage._id ? { ...m, _id: clientId, clientId, deliveryStatus: 'pending' } : m
        )
      )

      try {
        let nextMessage: MessageRecord | null = null
        if (socketRef.current?.connected) {
          nextMessage = await new Promise<MessageRecord>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('timeout')), 10000)
            socketRef.current?.emit(
              'send_message',
              { chatId, text, clientId },
              (ack: { ok: boolean; data?: MessageRecord; error?: string }) => {
                clearTimeout(timeout)
                if (ack.ok && ack.data) { resolve(ack.data); return }
                reject(new Error(ack.error || 'failed'))
              }
            )
          })
        } else {
          const response = await client.post(`/api/chat/${chatId}/message`, { text, clientId })
          if (response.data.ok) nextMessage = response.data.data as MessageRecord
        }
        if (nextMessage) {
          setMessages((prev) =>
            prev.map((m) => (m.clientId === clientId ? { ...nextMessage!, deliveryStatus: 'sent' } : m))
          )
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.clientId === clientId ? { ...m, deliveryStatus: 'failed' } : m))
        )
      }
    },
    [chatId]
  )

  const deleteMessage = useCallback(
    async (message: MessageRecord) => {
      if (deletingMessageId || message.deliveryStatus === 'pending') return

      if (message.deliveryStatus === 'failed') {
        setMessages((prev) => prev.filter((entry) => entry._id !== message._id))
        return
      }

      try {
        setDeletingMessageId(message._id)
        await client.delete(`/api/chat/${chatId}/messages/${message._id}`)
        setMessages((prev) => prev.filter((entry) => entry._id !== message._id))
      } catch (error: any) {
        Alert.alert(
          'Poruka nije obrisana',
          error?.response?.data?.error || error?.message || 'Pokusaj ponovo.'
        )
      } finally {
        setDeletingMessageId(null)
      }
    },
    [chatId, deletingMessageId]
  )

  const showMessageOptions = useCallback(
    (message: MessageRecord, isMine: boolean) => {
      if (!isMine || message.type !== 'text') return
      if (message.deliveryStatus === 'pending') return

      if (message.deliveryStatus === 'failed') {
        Alert.alert('Poruka nije poslata', 'Sta zelis da uradis?', [
          { text: 'Pokusaj ponovo', onPress: () => handleRetry(message) },
          { text: 'Obrisi', style: 'destructive', onPress: () => deleteMessage(message) },
          { text: 'Odustani', style: 'cancel' },
        ])
        return
      }

      Alert.alert('Poruka', 'Sta zelis da uradis?', [
        { text: 'Obrisi poruku', style: 'destructive', onPress: () => deleteMessage(message) },
        { text: 'Odustani', style: 'cancel' },
      ])
    },
    [deleteMessage, handleRetry]
  )

  const renderMessage = useCallback(
    ({ item, index }: { item: MessageRecord; index: number }) => {
      const isMine = getSenderId(item) === dbUser?._id
      const showDate = index === 0 || !isSameDay(item.createdAt, messagesRef.current[index - 1]?.createdAt)
      const proposalId = item.tradeData?.tradeRequestId || item.buyData?.tradeRequestId
      const showDecisionActions =
        canRespondToTrade &&
        !!activeTradeId &&
        proposalId === activeTradeId &&
        !isMine
      const senderDisplayName = getSenderDisplayName(item, isMine, otherUser)
      const requestedLabel = isMine ? getDisplayName(otherUser) : 'Ti'

      return (
        <View>
          {showDate ? (
            <Text className="my-3 text-center font-sans text-xs text-ink-dark/35">
              {formatDate(item.createdAt)}
            </Text>
          ) : null}

          {item.type === 'trade' && item.tradeData ? (
            <ProposalMessageCard
              title="Trade proposal"
              tradeData={item.tradeData}
              offeredLabel={senderDisplayName}
              requestedLabel={requestedLabel}
              onOpenOfferedItem={() => router.push(`/items/${item.tradeData!.offeredItemId}`)}
              onOpenRequestedItem={() => router.push(`/items/${item.tradeData!.requestedItemId}`)}
              showDecisionActions={showDecisionActions}
              submittingDecision={submittingDecision}
              onAccept={() =>
                Alert.alert('Prihvati predlog', 'Jesi li siguran/na da prihvataš ovu razmenu?', [
                  { text: 'Da, prihvatam', onPress: () => handleTradeDecision('accepted') },
                  { text: 'Odustani', style: 'cancel' },
                ])
              }
              onReject={() =>
                Alert.alert('Odbij predlog', 'Jesi li siguran/na da odbijаš ovaj predlog?', [
                  { text: 'Odbij', style: 'destructive', onPress: () => handleTradeDecision('rejected') },
                  { text: 'Odustani', style: 'cancel' },
                ])
              }
            />
          ) : item.type === 'buy' && item.buyData ? (
            <ProposalMessageCard
              title="Ponuda"
              buyData={item.buyData}
              requestedLabel={getDisplayName(otherUser)}
              onOpenRequestedItem={() => router.push(`/items/${item.buyData!.requestedItemId}`)}
              showDecisionActions={showDecisionActions}
              submittingDecision={submittingDecision}
              onAccept={() =>
                Alert.alert('Prihvati ponudu', 'Jesi li siguran/na da prihvataš ovu ponudu?', [
                  { text: 'Da, prihvatam', onPress: () => handleTradeDecision('accepted') },
                  { text: 'Odustani', style: 'cancel' },
                ])
              }
              onReject={() =>
                Alert.alert('Odbij ponudu', 'Jesi li siguran/na da odbijаš ovu ponudu?', [
                  { text: 'Odbij', style: 'destructive', onPress: () => handleTradeDecision('rejected') },
                  { text: 'Odustani', style: 'cancel' },
                ])
              }
            />
          ) : item.type === 'trade_update' && item.statusData ? (
            <TradeStatusTicket statusData={item.statusData} />
          ) : (
            <View className={`mb-1 px-4 ${isMine ? 'items-end' : 'items-start'}`}>
              <TouchableOpacity
                activeOpacity={item.deliveryStatus === 'failed' ? 0.7 : 1}
                onLongPress={() => showMessageOptions(item, isMine)}
              >
              <View
                className={`max-w-[82%] rounded-[22px] px-4 py-3 ${
                  isMine ? 'bg-brand-accent-deep' : 'bg-surface-panel'
                }`}
                style={
                  isMine
                    ? {
                        shadowColor: colors.accentDeep,
                        shadowOpacity: 0.2,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 4,
                      }
                    : {
                        shadowColor: colors.inkDark,
                        shadowOpacity: 0.05,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2,
                      }
                }
              >
                <Text
                  className={`font-sans text-[15px] leading-6 ${
                    isMine ? 'text-base-canvas' : 'text-ink-dark'
                  }`}
                >
                  {item.text}
                </Text>
              </View>
              <Text
                className={`mt-1 px-1 font-sans text-[10px] ${
                  item.deliveryStatus === 'failed' ? 'text-red-600' : 'text-ink-dark/30'
                }`}
              >
                {item.deliveryStatus === 'pending'
                  ? 'Slanje...'
                  : item.deliveryStatus === 'failed'
                    ? 'Nije poslato - drzi za opcije'
                  : deletingMessageId === item._id
                    ? 'Brisanje...'
                    : formatTime(item.createdAt)}
              </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )
    },
    [
      activeTradeId,
      canRespondToTrade,
      dbUser?._id,
      getSenderId,
      handleRetry,
      handleTradeDecision,
      otherUser,
      router,
      showMessageOptions,
      submittingDecision,
      deletingMessageId,
    ]
  )

  if (loading) {
    return <ChatSkeleton />
  }

  return (
    <KeyboardAwareScreen className="bg-base-canvas" offset={insets.top}>
      <BrandBackground />

      <View
        className="flex-row items-center px-4 pb-4"
        style={{
          paddingTop: insets.top + 8,
          shadowColor: colors.inkDark,
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
          backgroundColor: colors.baseCanvas,
          zIndex: 2,
        }}
      >
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/chat')}
          className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-surface-panel"
        >
          <Ionicons name="arrow-back" size={22} color={colors.inkDark} />
        </TouchableOpacity>

        {otherUser?.photoURL ? (
          <RemoteImage
            uri={otherUser.photoURL}
            className="h-12 w-12 rounded-full"
            fallback={
              <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-light/35">
                <Text className="font-display text-2xl text-brand-accent-deep">
                  {getDisplayName(otherUser).charAt(0).toUpperCase()}
                </Text>
              </View>
            }
          />
        ) : (
          <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-accent-light/35">
            <Text className="font-display text-2xl text-brand-accent-deep">
              {getDisplayName(otherUser).charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View className="ml-3 flex-1">
          <Text className="font-display text-3xl text-ink-dark">{getDisplayName(otherUser)}</Text>
          <Text className="font-sans text-xs text-ink-dark/55">
            {typingUser
              ? t('chat.typeStatus', { name: typingUser })
              : tradeRequest?.status === 'pending'
                ? 'Predlog ceka odluku'
                : tradeRequest?.status === 'accepted'
                  ? 'Predlog prihvacen'
                  : t('chat.directConversation')}
          </Text>
        </View>
      </View>

      <View className="flex-1">
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: composerHeight + 24, flexGrow: 1 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            <View className="items-center justify-center px-6 py-20">
              <Ionicons
                name="chatbubble-outline"
                size={48}
                color={colors.inkDark}
                style={{ opacity: 0.15 }}
              />
              <Text className="mt-4 font-sans text-sm text-ink-dark/45">
                {t('chat.threadEmpty')}
              </Text>
            </View>
          }
        />

        <View
          className="absolute left-0 right-0 px-4"
          onLayout={(event) => {
            setComposerHeight(event.nativeEvent.layout.height)
          }}
          style={{
            bottom: 0,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View
            className="flex-row items-end rounded-[30px] bg-base-canvas px-2 py-2"
            style={{
              shadowColor: colors.inkDark,
              shadowOpacity: 0.1,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <VelveTextInput
              value={inputText}
              onChangeText={(text) => {
                setInputText(text)
                handleTyping()
              }}
              placeholder={t('chat.placeholder')}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              className="max-h-[120px] flex-1 rounded-[24px] px-4 py-3 font-sans text-[15px] leading-6 text-ink-dark"
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.88}
              className={`ml-2 h-11 w-11 items-center justify-center rounded-full ${
                inputText.trim() && !sending ? 'bg-brand-accent-deep' : 'bg-ink-dark/10'
              }`}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={inputText.trim() && !sending ? colors.baseCanvas : colors.mutedText}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAwareScreen>
  )
}
