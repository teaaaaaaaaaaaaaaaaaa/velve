import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/hooks/useAuth'
import client from '@/api/client'

interface Participant {
  _id: string
  displayName: string
  photoURL: string
}

interface LastMessage {
  _id: string
  text: string
  senderId: { _id: string; displayName: string }
  createdAt: string
}

interface ChatRoom {
  _id: string
  participants: Participant[]
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
  return date.toLocaleDateString('sr-Latn')
}

export default function ChatListScreen() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [chats, setChats] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchChats = async () => {
    try {
      const response = await client.get('/api/chat')
      if (response.data.ok) {
        setChats(response.data.data)
      }
    } catch (error: any) {
      console.error('[ChatList] Error fetching chats:', error.message)
    }
  }

  useEffect(() => {
    fetchChats().finally(() => setLoading(false))
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchChats()
    setRefreshing(false)
  }, [])

  const getOtherParticipant = (participants: Participant[]) => {
    if (!currentUser) return participants[0]
    return participants.find((p) => p._id !== currentUser.uid) || participants[0]
  }

  const renderChatItem = ({ item }: { item: ChatRoom }) => {
    const other = getOtherParticipant(item.participants)
    const lastMsg = item.lastMessage

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(tabs)/chat/${item._id}`)}
        className="flex-row items-center px-6 py-4 border-b border-ink-dark/5"
        activeOpacity={0.7}
      >
        {/* Avatar */}
        {other?.photoURL ? (
          <Image
            source={{ uri: other.photoURL }}
            className="w-14 h-14 rounded-full mr-4"
          />
        ) : (
          <View className="w-14 h-14 rounded-full bg-brand-accent-light items-center justify-center mr-4">
            <Text className="font-display text-brand-accent-deep text-xl">
              {(other?.displayName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Content */}
        <View className="flex-1 mr-3">
          <Text className="font-sans text-base font-semibold text-ink-dark" numberOfLines={1}>
            {other?.displayName || 'Korisnik'}
          </Text>
          {lastMsg ? (
            <Text className="font-sans text-sm text-ink-dark/60 mt-1" numberOfLines={1}>
              {lastMsg.text}
            </Text>
          ) : (
            <Text className="font-sans text-sm text-ink-dark/40 mt-1 italic">
              Započni razgovor
            </Text>
          )}
        </View>

        {/* Time */}
        {lastMsg && (
          <Text className="font-sans text-xs text-ink-dark/40">
            {formatTime(lastMsg.createdAt)}
          </Text>
        )}
      </TouchableOpacity>
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
    <View className="flex-1 bg-base-canvas">
      {/* Header */}
      <View className="px-6 pt-16 pb-4 border-b border-ink-dark/5">
        <Text className="font-display text-2xl text-ink-dark">Poruke</Text>
      </View>

      {chats.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="chatbubbles-outline" size={64} color="#2B2A2B" style={{ opacity: 0.2 }} />
          <Text className="font-display text-lg text-ink-dark mt-4">Nema poruka</Text>
          <Text className="font-sans text-sm text-ink-dark/50 text-center mt-2">
            Kada predložiš ili primiš razmenu, razgovor će se pojaviti ovde.
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item._id}
          renderItem={renderChatItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  )
}
