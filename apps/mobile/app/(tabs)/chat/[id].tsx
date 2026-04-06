import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native'
import { io, Socket } from 'socket.io-client'

import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { ChatSkeleton } from '@/components/BrandedLoader'
import { RemoteImage } from '@/components/RemoteImage'
import { BrandWordmark } from '@/components/BrandWordmark'
import { colors } from '@/design/tokens'
import { useAuth } from '@/hooks/useAuth'
import { API_URL } from '@/config/api'
import { auth as firebaseAuth } from '@/config/firebase'
import { useI18n } from '@/i18n'

type Participant = {
  _id: string
  displayName: string
  photoURL?: string
  email?: string
}

type TradeData = {
  offeredItemId: string
  offeredItemTitle: string
  offeredItemImage?: string
  requestedItemId: string
  requestedItemTitle: string
  requestedItemImage?: string
}

type BuyData = {
  requestedItemId: string
  requestedItemTitle: string
  requestedItemImage?: string
}

type StatusData = {
  tradeRequestId: string
  status: string
  label: string
}

type MessageRecord = {
  _id: string
  chatId: string
  senderId: { _id: string; displayName: string; photoURL?: string } | string
  text: string
  type?: 'text' | 'trade' | 'buy' | 'trade_update'
  tradeData?: TradeData
  buyData?: BuyData
  statusData?: StatusData
  createdAt: string
}

type ChatPayload = {
  participants: Participant[]
  tradeRequestId?: { _id: string; status?: string } | null
  messages: MessageRecord[]
}

function getDisplayName(participant: Participant | null) {
  if (!participant) return 'Korisnik'
  return participant.displayName || participant.email?.split('@')[0] || 'Korisnik'
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

function ItemMiniCard({
  title,
  imageUri,
  eyebrow,
}: {
  title: string
  imageUri?: string
  eyebrow: string
}) {
  return (
    <View className="flex-1">
      <View className="overflow-hidden rounded-[16px] bg-base-canvas">
        {imageUri ? (
          <RemoteImage
            uri={imageUri}
            className="aspect-square w-full"
            fallback={
              <View className="aspect-square w-full items-center justify-center bg-brand-accent-light/20">
                <Ionicons name="shirt-outline" size={24} color="#431A43" />
              </View>
            }
          />
        ) : (
          <View className="aspect-square w-full items-center justify-center bg-brand-accent-light/20">
            <Ionicons name="shirt-outline" size={24} color="#431A43" />
          </View>
        )}
      </View>
      <Text className="mt-2 font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/45">
        {eyebrow}
      </Text>
      <Text className="font-sans text-sm font-semibold leading-5 text-ink-dark" numberOfLines={2}>
        {title}
      </Text>
    </View>
  )
}

function TradeMessageCard({
  tradeData,
  onViewRequested,
}: {
  tradeData: TradeData
  onViewRequested: () => void
}) {
  return (
    <View className="mx-4 my-2 overflow-hidden rounded-[24px] border border-brand-accent-deep/10 bg-white px-4 py-4">
      <Text className="font-display text-2xl text-ink-dark">Trade proposal</Text>
      <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/65">
        Editorial preview oba komada unutar iste poruke.
      </Text>

      <View className="mt-4 flex-row items-center gap-3">
        <ItemMiniCard
          title={tradeData.offeredItemTitle}
          imageUri={tradeData.offeredItemImage}
          eyebrow="Nudi"
        />
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-accent-deep/8">
          <Ionicons name="swap-horizontal" size={18} color="#431A43" />
        </View>
        <ItemMiniCard
          title={tradeData.requestedItemTitle}
          imageUri={tradeData.requestedItemImage}
          eyebrow="Trazi"
        />
      </View>

      <TouchableOpacity
        onPress={onViewRequested}
        className="mt-4 items-center rounded-full bg-base-canvas px-4 py-3"
      >
        <Text className="font-sans text-sm font-semibold text-ink-dark">Otvori trazeni predmet</Text>
      </TouchableOpacity>
    </View>
  )
}

function BuyMessageCard({
  buyData,
  onViewRequested,
}: {
  buyData: BuyData
  onViewRequested: () => void
}) {
  return (
    <View className="mx-4 my-2 overflow-hidden rounded-[24px] border border-brand-accent-deep/10 bg-white px-4 py-4">
      <Text className="font-display text-2xl text-ink-dark">Buy request</Text>
      <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/65">
        Kupovina ulazi kroz isti premium thread kao trade.
      </Text>

      <View className="mt-4">
        <ItemMiniCard
          title={buyData.requestedItemTitle}
          imageUri={buyData.requestedItemImage}
          eyebrow="Predmet"
        />
      </View>

      <TouchableOpacity
        onPress={onViewRequested}
        className="mt-4 items-center rounded-full bg-base-canvas px-4 py-3"
      >
        <Text className="font-sans text-sm font-semibold text-ink-dark">Otvori predmet</Text>
      </TouchableOpacity>
    </View>
  )
}

function TradeStatusTicket({
  statusData,
  onOpenDesk,
}: {
  statusData: StatusData
  onOpenDesk: () => void
}) {
  return (
    <View className="mx-4 my-2 overflow-hidden rounded-[22px] border border-ink-dark/8 bg-white px-4 py-4">
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-accent-light/25">
          <Ionicons name="sparkles-outline" size={18} color="#431A43" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/45">
            Trade update
          </Text>
          <Text className="font-sans text-sm leading-6 text-ink-dark/75">{statusData.label}</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onOpenDesk}
        className="mt-4 items-center rounded-full bg-base-canvas px-4 py-3"
      >
        <Text className="font-sans text-sm font-semibold text-ink-dark">Otvori trade desk</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function ChatScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { dbUser } = useAuth()
  const { t } = useI18n()

  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [otherUser, setOtherUser] = useState<Participant | null>(null)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [tradeStatus, setTradeStatus] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const flatListRef = useRef<FlatList<MessageRecord>>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchChat = useCallback(async () => {
    const response = await client.get(`/api/chat/${chatId}`)
    if (response.data.ok) {
      const data = response.data.data as ChatPayload
      setMessages(data.messages || [])
      setTradeStatus(data.tradeRequestId?.status || null)

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

      const token = await user.getIdToken()
      socket = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      })

      socket.on('connect', () => {
        socket?.emit('join_chat', chatId)
      })

      socket.on('new_message', (payload: { chatId: string; message: MessageRecord }) => {
        if (payload.chatId !== chatId) return

        setMessages((prev) => {
          if (prev.some((message) => message._id === payload.message._id)) {
            return prev
          }
          return [...prev, payload.message]
        })
      })

      socket.on('user_typing', (payload: { chatId: string; displayName: string }) => {
        if (payload.chatId !== chatId) return

        setTypingUser(payload.displayName)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000)
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

    setInputText('')
    setSending(true)

    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('send_message', { chatId, text })
      } else {
        const response = await client.post(`/api/chat/${chatId}/message`, { text })
        if (response.data.ok) {
          const nextMessage = response.data.data as MessageRecord
          setMessages((prev) => {
            if (prev.some((message) => message._id === nextMessage._id)) {
              return prev
            }
            return [...prev, nextMessage]
          })
        }
      }
    } catch {
      setInputText(text)
    } finally {
      setSending(false)
    }
  }, [chatId, inputText, sending])

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

  const renderMessage = useCallback(
    ({ item, index }: { item: MessageRecord; index: number }) => {
      const isMine = getSenderId(item) === dbUser?._id
      const showDate = index === 0 || !isSameDay(item.createdAt, messages[index - 1]?.createdAt)

      return (
        <View>
          {showDate ? (
            <Text className="my-3 text-center font-sans text-xs text-ink-dark/35">
              {formatDate(item.createdAt)}
            </Text>
          ) : null}

          {item.type === 'trade' && item.tradeData ? (
            <TradeMessageCard
              tradeData={item.tradeData}
              onViewRequested={() => router.push(`/items/${item.tradeData?.requestedItemId}`)}
            />
          ) : item.type === 'buy' && item.buyData ? (
            <BuyMessageCard
              buyData={item.buyData}
              onViewRequested={() => router.push(`/items/${item.buyData?.requestedItemId}`)}
            />
          ) : item.type === 'trade_update' && item.statusData ? (
            <TradeStatusTicket
              statusData={item.statusData}
              onOpenDesk={() => router.push('/(tabs)/trades')}
            />
          ) : (
            <View className={`mb-1 px-4 ${isMine ? 'items-end' : 'items-start'}`}>
              <View
                className={`max-w-[82%] rounded-[22px] px-4 py-3 ${isMine ? 'bg-brand-accent-deep' : 'border border-ink-dark/8 bg-white'}`}
              >
                <Text
                  className={`font-sans text-[15px] leading-6 ${isMine ? 'text-base-canvas' : 'text-ink-dark'}`}
                >
                  {item.text}
                </Text>
              </View>
              <Text className="mt-1 px-1 font-sans text-[10px] text-ink-dark/30">
                {formatTime(item.createdAt)}
              </Text>
            </View>
          )}
        </View>
      )
    },
    [dbUser?._id, getSenderId, messages, router]
  )

  if (loading) {
    return <ChatSkeleton />
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-base-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <BrandBackground />
      <View className="flex-row items-center border-b border-ink-dark/8 px-4 pb-4 pt-14">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-white"
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
          <BrandWordmark width={90} />
          <Text className="font-display text-3xl text-ink-dark">{getDisplayName(otherUser)}</Text>
          <Text className="font-sans text-xs text-ink-dark/55">
            {typingUser
              ? t('chat.typeStatus', { name: typingUser })
              : tradeStatus
                ? t('chat.tradeStatusLabel', { status: tradeStatus })
                : t('chat.directConversation')}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(tabs)/trades')}
          className="h-11 w-11 items-center justify-center rounded-full bg-white"
        >
          <Ionicons name="swap-horizontal" size={20} color={colors.accentDeep} />
        </TouchableOpacity>
      </View>

      {tradeStatus ? (
        <View className="mx-4 mt-4 rounded-[22px] border border-brand-accent-deep/10 bg-white px-4 py-4">
          <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-ink-dark/45">
            {t('chat.lifecycle')}
          </Text>
          <Text className="mt-1 font-sans text-sm leading-6 text-ink-dark/70">
            {t('chat.tradeStatusPanel', { status: tradeStatus })}
          </Text>
        </View>
      ) : null}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={renderMessage}
        contentContainerStyle={{ paddingVertical: 16 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
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

      <View className="flex-row items-end border-t border-ink-dark/8 px-4 py-3">
        <TextInput
          value={inputText}
          onChangeText={(text) => {
            setInputText(text)
            handleTyping()
          }}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={colors.mutedText}
          multiline
          maxLength={1000}
          className="max-h-[120px] flex-1 rounded-[24px] border border-ink-dark/10 bg-white px-4 py-3 font-sans text-[15px] leading-6 text-ink-dark"
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          className={`ml-3 h-12 w-12 items-center justify-center rounded-full ${inputText.trim() && !sending ? 'bg-brand-accent-deep' : 'bg-ink-dark/10'}`}
        >
          <Ionicons
            name="send"
            size={18}
            color={inputText.trim() && !sending ? colors.baseCanvas : colors.mutedText}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
