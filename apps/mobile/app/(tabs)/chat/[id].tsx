import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/hooks/useAuth'
import { auth as firebaseAuth } from '@/config/firebase'
import client from '@/api/client'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

interface Participant {
  _id: string
  displayName: string
  photoURL: string
  email?: string
}

interface TradeData {
  offeredItemId: string
  offeredItemTitle: string
  offeredItemImage: string
  requestedItemId: string
  requestedItemTitle: string
  requestedItemImage: string
}

interface BuyData {
  requestedItemId: string
  requestedItemTitle: string
  requestedItemImage: string
}

interface Message {
  _id: string
  chatId: string
  senderId: { _id: string; displayName: string; photoURL: string } | string
  text: string
  type?: 'text' | 'trade' | 'buy'
  tradeData?: TradeData
  buyData?: BuyData
  createdAt: string
}

function getDisplayName(p: Participant | null | undefined): string {
  if (!p) return 'Korisnik'
  if (p.displayName) return p.displayName
  if (p.email) return p.email.split('@')[0]
  return 'Korisnik'
}

export default function ChatScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { dbUser } = useAuth()

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [otherUser, setOtherUser] = useState<Participant | null>(null)
  const [typingUser, setTypingUser] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchChat = useCallback(async () => {
    try {
      const response = await client.get(`/api/chat/${chatId}`)
      if (response.data.ok) {
        const data = response.data.data
        setMessages(data.messages || [])

        if (data.participants && dbUser) {
          const other = data.participants.find(
            (p: Participant) => p._id !== dbUser._id
          )
          setOtherUser(other || null)
        }
      }
    } catch (error: any) {
      console.error('[Chat] Error fetching chat:', error.message)
    } finally {
      setLoading(false)
    }
  }, [chatId, dbUser])

  useEffect(() => {
    fetchChat()
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

      socket.on('new_message', (data: { chatId: string; message: Message }) => {
        if (data.chatId === chatId) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === data.message._id)) return prev
            return [...prev, data.message]
          })
        }
      })

      socket.on('user_typing', (data: { chatId: string; displayName: string }) => {
        if (data.chatId === chatId) {
          setTypingUser(data.displayName)
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000)
        }
      })

      socketRef.current = socket
    }

    connectSocket()

    return () => {
      if (socket) {
        socket.emit('leave_chat', chatId)
        socket.disconnect()
        socketRef.current = null
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [chatId])

  const handleSend = async () => {
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
          setMessages((prev) => {
            if (prev.some((m) => m._id === response.data.data._id)) return prev
            return [...prev, response.data.data]
          })
        }
      }
    } catch (error: any) {
      console.error('[Chat] Error sending message:', error.message)
    } finally {
      setSending(false)
    }
  }

  const handleTyping = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', chatId)
    }
  }

  const getSenderId = (msg: Message): string => {
    if (typeof msg.senderId === 'object' && msg.senderId?._id) return msg.senderId._id
    return msg.senderId as string
  }

  const isMyMessage = (msg: Message): boolean => {
    return getSenderId(msg) === dbUser?._id
  }

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = isMyMessage(item)
    const showDate = index === 0 || !isSameDay(item.createdAt, messages[index - 1]?.createdAt)

    if (item.type === 'trade' && item.tradeData) {
      return (
        <View>
          {showDate && (
            <Text style={styles.dateLabel}>{formatDate(item.createdAt)}</Text>
          )}
          <TradeCard
            tradeData={item.tradeData}
            text={item.text}
            onViewItem={() =>
              router.push(`/items/${item.tradeData!.offeredItemId}?viewOnly=true`)
            }
          />
        </View>
      )
    }

    if (item.type === 'buy' && item.buyData) {
      return (
        <View>
          {showDate && (
            <Text style={styles.dateLabel}>{formatDate(item.createdAt)}</Text>
          )}
          <BuyCard
            buyData={item.buyData}
            text={item.text}
            onViewItem={() =>
              router.push(`/items/${item.buyData!.requestedItemId}?viewOnly=true`)
            }
          />
        </View>
      )
    }

    return (
      <View>
        {showDate && (
          <Text style={styles.dateLabel}>{formatDate(item.createdAt)}</Text>
        )}
        <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowTheirs]}>
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleTheirs,
            ]}
          >
            <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
              {item.text}
            </Text>
          </View>
          <Text style={styles.timeLabel}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#431A43" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#2B2A2B" />
        </TouchableOpacity>

        {otherUser?.photoURL ? (
          <Image source={{ uri: otherUser.photoURL }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
            <Text style={styles.headerAvatarText}>
              {getDisplayName(otherUser).charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{getDisplayName(otherUser)}</Text>
          {typingUser && <Text style={styles.typingText}>piše...</Text>}
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={renderMessage}
        contentContainerStyle={{ paddingVertical: 16 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={48} color="#2B2A2B" style={{ opacity: 0.15 }} />
            <Text style={styles.emptyText}>Započni razgovor</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Napiši poruku..."
          placeholderTextColor="#2B2A2B50"
          value={inputText}
          onChangeText={(text) => { setInputText(text); handleTyping() }}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          style={[styles.sendBtn, inputText.trim() && !sending ? styles.sendBtnActive : styles.sendBtnDisabled]}
        >
          <Ionicons
            name="send"
            size={20}
            color={inputText.trim() && !sending ? '#F6F8ED' : '#2B2A2B50'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

function TradeCard({
  tradeData,
  text,
  onViewItem,
}: {
  tradeData: TradeData
  text: string
  onViewItem: () => void
}) {
  return (
    <View style={styles.tradeCard}>
      <Text style={styles.tradeCardTitle}>Predlog razmene</Text>

      {/* Two items side by side */}
      <View style={styles.tradeItems}>
        {/* Offered item (sender's) */}
        <View style={styles.tradeItem}>
          <Image
            source={{ uri: tradeData.offeredItemImage || '' }}
            style={styles.tradeItemImage}
            resizeMode="cover"
          />
          <Text style={styles.tradeItemLabel} numberOfLines={2}>
            {tradeData.offeredItemTitle}
          </Text>
          <Text style={styles.tradeItemRole}>Nudi</Text>
        </View>

        {/* Arrow */}
        <View style={styles.tradeArrow}>
          <Ionicons name="swap-horizontal" size={24} color="#431A43" />
        </View>

        {/* Requested item (receiver's) */}
        <View style={styles.tradeItem}>
          <Image
            source={{ uri: tradeData.requestedItemImage || '' }}
            style={styles.tradeItemImage}
            resizeMode="cover"
          />
          <Text style={styles.tradeItemLabel} numberOfLines={2}>
            {tradeData.requestedItemTitle}
          </Text>
          <Text style={styles.tradeItemRole}>Za tvoj</Text>
        </View>
      </View>

      {/* View button */}
      <TouchableOpacity style={styles.tradeViewBtn} onPress={onViewItem} activeOpacity={0.8}>
        <Text style={styles.tradeViewBtnText}>Vidi predloženi predmet</Text>
        <Ionicons name="arrow-forward" size={16} color="#431A43" />
      </TouchableOpacity>
    </View>
  )
}

function BuyCard({
  buyData,
  text,
  onViewItem,
}: {
  buyData: BuyData
  text: string
  onViewItem: () => void
}) {
  return (
    <View style={styles.buyCard}>
      <Text style={styles.buyCardTitle}>Zahtev za kupovinu</Text>

      <View style={styles.buyItemRow}>
        <Image
          source={{ uri: buyData.requestedItemImage || '' }}
          style={styles.buyItemImage}
          resizeMode="cover"
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.buyItemLabel} numberOfLines={2}>
            {buyData.requestedItemTitle}
          </Text>
          <Text style={styles.buyItemSubtext}>želi da kupi ovaj item</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.tradeViewBtn} onPress={onViewItem} activeOpacity={0.8}>
        <Text style={styles.tradeViewBtnText}>Vidi item</Text>
        <Ionicons name="arrow-forward" size={16} color="#431A43" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8ED' },
  centered: { flex: 1, backgroundColor: '#F6F8ED', justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(43,42,43,0.05)',
    backgroundColor: '#F6F8ED',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerAvatarPlaceholder: { backgroundColor: '#9DD3E4', justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { fontFamily: 'AlteHaasGrotesk-Bold', fontSize: 18, color: '#431A43' },
  headerName: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: '#2B2A2B' },
  typingText: { fontFamily: 'Inter', fontSize: 12, color: '#431A43' },
  dateLabel: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: 'rgba(43,42,43,0.4)',
    textAlign: 'center',
    marginVertical: 12,
  },
  msgRow: { paddingHorizontal: 16, marginBottom: 4 },
  msgRowMine: { alignItems: 'flex-end' },
  msgRowTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: '#431A43', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: 'white', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(43,42,43,0.08)' },
  bubbleText: { fontFamily: 'Inter', fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: '#F6F8ED' },
  bubbleTextTheirs: { color: '#2B2A2B' },
  timeLabel: { fontFamily: 'Inter', fontSize: 10, color: 'rgba(43,42,43,0.3)', marginTop: 2, paddingHorizontal: 4 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontFamily: 'Inter', fontSize: 13, color: 'rgba(43,42,43,0.4)', marginTop: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(43,42,43,0.05)',
    backgroundColor: '#F6F8ED',
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(43,42,43,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#2B2A2B',
    maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
  sendBtnActive: { backgroundColor: '#431A43' },
  sendBtnDisabled: { backgroundColor: 'rgba(43,42,43,0.1)' },
  // Trade card
  tradeCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(67,26,67,0.15)',
  },
  tradeCardTitle: {
    fontFamily: 'AlteHaasGrotesk-Bold',
    fontSize: 15,
    color: '#431A43',
    marginBottom: 14,
    textAlign: 'center',
  },
  tradeItems: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  tradeItem: { flex: 1, alignItems: 'center' },
  tradeItemImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#E8F7FB',
    marginBottom: 6,
  },
  tradeItemLabel: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: '#2B2A2B',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  tradeItemRole: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: 'rgba(43,42,43,0.5)',
    marginTop: 2,
    textAlign: 'center',
  },
  tradeArrow: { paddingHorizontal: 10 },
  tradeViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(67,26,67,0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  tradeViewBtnText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#431A43',
    fontWeight: '700',
  },
  // Buy card
  buyCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(203,218,99,0.4)',
  },
  buyCardTitle: {
    fontFamily: 'AlteHaasGrotesk-Bold',
    fontSize: 15,
    color: '#2B2A2B',
    marginBottom: 14,
    textAlign: 'center',
  },
  buyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  buyItemImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#E8F7FB',
  },
  buyItemLabel: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#2B2A2B',
    fontWeight: '600',
    lineHeight: 19,
  },
  buyItemSubtext: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: 'rgba(43,42,43,0.5)',
    marginTop: 4,
  },
})

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (diffDays === 0) return 'Danas'
  if (diffDays === 1) return 'Juče'
  return date.toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long' })
}

function isSameDay(a: string, b: string) {
  if (!a || !b) return false
  return new Date(a).toDateString() === new Date(b).toDateString()
}
