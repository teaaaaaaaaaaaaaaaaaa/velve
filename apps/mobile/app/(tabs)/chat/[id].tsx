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
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/hooks/useAuth'
import { auth as firebaseAuth } from '@/config/firebase'
import client from '@/api/client'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

interface Sender {
  _id: string
  displayName: string
  photoURL: string
}

interface Message {
  _id: string
  chatId: string
  senderId: Sender | string
  text: string
  createdAt: string
}

interface Participant {
  _id: string
  displayName: string
  photoURL: string
}

export default function ChatScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { currentUser } = useAuth()

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [otherUser, setOtherUser] = useState<Participant | null>(null)
  const [myDbId, setMyDbId] = useState<string>('')
  const [typingUser, setTypingUser] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch chat data and messages via REST
  const fetchChat = useCallback(async () => {
    try {
      const response = await client.get(`/api/chat/${chatId}`)
      if (response.data.ok) {
        const data = response.data.data
        setMessages(data.messages || [])

        // Find the other participant
        if (data.participants && currentUser) {
          const meRes = await client.get('/api/users/me')
          if (meRes.data.ok) {
            setMyDbId(meRes.data.data._id)
            const other = data.participants.find(
              (p: Participant) => p._id !== meRes.data.data._id
            )
            setOtherUser(other || null)
          }
        }
      }
    } catch (error: any) {
      console.error('[Chat] Error fetching chat:', error.message)
    } finally {
      setLoading(false)
    }
  }, [chatId, currentUser])

  // Connect WebSocket
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
        console.log('[Chat] Socket connected')
        socket?.emit('join_chat', chatId)
      })

      socket.on('new_message', (data: { chatId: string; message: Message }) => {
        if (data.chatId === chatId) {
          setMessages((prev) => {
            // Avoid duplicates
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

      socket.on('disconnect', () => {
        console.log('[Chat] Socket disconnected')
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

  useEffect(() => {
    fetchChat()
  }, [fetchChat])

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || sending) return

    setInputText('')
    setSending(true)

    try {
      // Try WebSocket first
      if (socketRef.current?.connected) {
        socketRef.current.emit('send_message', { chatId, text })
      } else {
        // Fallback to REST
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
    if (typeof msg.senderId === 'object' && msg.senderId?._id) {
      return msg.senderId._id
    }
    return msg.senderId as string
  }

  const getSenderName = (msg: Message): string => {
    if (typeof msg.senderId === 'object' && msg.senderId?.displayName) {
      return msg.senderId.displayName
    }
    return ''
  }

  const isMyMessage = (msg: Message): boolean => {
    return getSenderId(msg) === myDbId
  }

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = isMyMessage(item)
    const showDate = index === 0 || !isSameDay(item.createdAt, messages[index - 1]?.createdAt)

    return (
      <View>
        {showDate && (
          <Text className="font-sans text-xs text-ink-dark/40 text-center my-4">
            {formatDate(item.createdAt)}
          </Text>
        )}
        <View className={`px-4 mb-2 ${isMine ? 'items-end' : 'items-start'}`}>
          <View
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              isMine
                ? 'bg-brand-accent-deep rounded-br-sm'
                : 'bg-white border border-ink-dark/10 rounded-bl-sm'
            }`}
          >
            <Text
              className={`font-sans text-base ${
                isMine ? 'text-base-canvas' : 'text-ink-dark'
              }`}
            >
              {item.text}
            </Text>
          </View>
          <Text className="font-sans text-[10px] text-ink-dark/30 mt-1 px-1">
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className="flex-1 bg-base-canvas justify-center items-center">
        <ActivityIndicator size="large" color="#431A43" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-base-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 pt-16 pb-4 border-b border-ink-dark/5 bg-base-canvas">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 w-10 h-10 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="#2B2A2B" />
        </TouchableOpacity>

        {otherUser?.photoURL ? (
          <Image
            source={{ uri: otherUser.photoURL }}
            className="w-10 h-10 rounded-full mr-3"
          />
        ) : (
          <View className="w-10 h-10 rounded-full bg-brand-accent-light items-center justify-center mr-3">
            <Text className="font-display text-brand-accent-deep text-lg">
              {(otherUser?.displayName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View className="flex-1">
          <Text className="font-sans text-base font-semibold text-ink-dark">
            {otherUser?.displayName || 'Korisnik'}
          </Text>
          {typingUser && (
            <Text className="font-sans text-xs text-brand-accent-deep">
              piše...
            </Text>
          )}
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
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="chatbubble-outline" size={48} color="#2B2A2B" style={{ opacity: 0.15 }} />
            <Text className="font-sans text-sm text-ink-dark/40 mt-3">
              Započni razgovor
            </Text>
          </View>
        }
      />

      {/* Input */}
      <View className="flex-row items-end px-4 py-3 border-t border-ink-dark/5 bg-base-canvas">
        <TextInput
          className="flex-1 bg-white border border-ink-dark/15 rounded-2xl px-4 py-3 font-sans text-base text-ink-dark max-h-[120px]"
          placeholder="Napiši poruku..."
          placeholderTextColor="#2B2A2B50"
          value={inputText}
          onChangeText={(text) => {
            setInputText(text)
            handleTyping()
          }}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          className={`ml-3 w-12 h-12 rounded-full items-center justify-center ${
            inputText.trim() && !sending
              ? 'bg-brand-accent-deep'
              : 'bg-ink-dark/15'
          }`}
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

// Helpers
function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)

  if (diffDays === 0) return 'Danas'
  if (diffDays === 1) return 'Juče'
  return date.toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long' })
}

function isSameDay(a: string, b: string) {
  if (!a || !b) return false
  const da = new Date(a)
  const db = new Date(b)
  return da.toDateString() === db.toDateString()
}
