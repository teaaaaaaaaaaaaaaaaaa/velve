import { useState, useEffect, useRef, useCallback, memo } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Pressable,
  Animated,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import client from '@/api/client'

type Item = {
  _id: string
  title: string
  description: string
  category: string
  brand: string
  size: string
  condition: 'new' | 'like_new' | 'good' | 'fair'
  status?: 'available' | 'pending_trade' | 'traded'
  images: string[]
  userId: {
    _id: string
    displayName: string
    photoURL: string
  }
  createdAt: string
  likesCount?: number
  isLiked?: boolean
}

type FeedResponse = {
  ok: boolean
  data: Item[]
  page: number
  hasMore: boolean
}

export default function FeedScreen() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchFeed = async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else if (pageNum === 0) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }

      const response = await client.get<FeedResponse>('/api/feed', {
        params: { limit: 20, page: pageNum },
      })

      if (response.data.ok) {
        if (isRefresh || pageNum === 0) {
          setItems(response.data.data)
        } else {
          setItems((prev) => [...prev, ...response.data.data])
        }
        setHasMore(response.data.hasMore)
        setPage(response.data.page)
      }
    } catch (error: any) {
      Alert.alert(
        'Greska',
        error.response?.data?.message || 'Nije moguce ucitati feed.'
      )
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchFeed(0)
  }, [])

  const handleRefresh = () => {
    fetchFeed(0, true)
  }

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchFeed(page + 1)
    }
  }

  const handleLike = useCallback(async (itemId: string) => {
    try {
      await client.post(`/api/items/${itemId}/like`)
      setItems((prev) =>
        prev.map((item) =>
          item._id === itemId
            ? {
                ...item,
                isLiked: !item.isLiked,
                likesCount: item.isLiked
                  ? (item.likesCount ?? 0) - 1
                  : (item.likesCount ?? 0) + 1,
              }
            : item
        )
      )
    } catch (error: any) {
      Alert.alert('Greska', 'Nije moguce lajkovati item.')
    }
  }, [])

  const handleItemPress = useCallback((itemId: string) => {
    router.push(`/items/${itemId}`)
  }, [router])

  const renderItem = ({ item }: { item: Item }) => (
    <ItemCard
      item={item}
      onLike={() => handleLike(item._id)}
      onPress={() => handleItemPress(item._id)}
    />
  )

  const renderFooter = () => {
    if (!isLoadingMore) return null
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color="#431A43" />
      </View>
    )
  }

  const renderSkeleton = () => (
    <View className="flex-1 bg-base-canvas px-4">
      {[1, 2, 3].map((i) => (
        <View key={i} className="bg-white rounded-2xl mb-4 p-4">
          <View className="w-full h-80 bg-gray-200 rounded-xl mb-3" />
          <View className="h-6 bg-gray-200 rounded mb-2 w-3/4" />
          <View className="h-4 bg-gray-200 rounded mb-2 w-1/2" />
          <View className="flex-row items-center mt-2">
            <View className="w-8 h-8 rounded-full bg-gray-200 mr-2" />
            <View className="h-4 bg-gray-200 rounded w-24" />
          </View>
        </View>
      ))}
    </View>
  )

  if (isLoading) {
    return renderSkeleton()
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-base-canvas justify-center items-center px-6">
        <Text className="font-display text-ink-dark text-2xl mb-2">Feed je prazan</Text>
        <Text className="font-sans text-ink-dark opacity-60 text-center mb-6">
          Budi prvi koji ce dodati garderobu!
        </Text>
        <TouchableOpacity
          onPress={handleRefresh}
          className="bg-brand-accent-deep rounded-full py-4 px-8"
        >
          <Text className="font-sans text-base-canvas font-semibold">Osvezi</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#431A43"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
      />
    </View>
  )
}

type ItemCardProps = {
  item: Item
  onLike: () => void
  onPress: () => void
}

const ItemCard = memo(function ItemCard({ item, onLike, onPress }: ItemCardProps) {
  const scale = useRef(new Animated.Value(1)).current
  const heartScale = useRef(new Animated.Value(0)).current
  const [lastTap, setLastTap] = useState(0)

  const handleDoubleTap = () => {
    const now = Date.now()
    if (now - lastTap < 300) {
      onLike()
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.2, useNativeDriver: true }),
        Animated.spring(heartScale, { toValue: 0, useNativeDriver: true }),
      ]).start()
    }
    setLastTap(now)
  }

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()
  }

  const heroImage = item.images[0] || 'https://via.placeholder.com/400'

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className="bg-white rounded-2xl mb-4 overflow-hidden shadow-sm"
      >
        {/* Hero slika sa dupli-tap detektorom */}
        <Pressable onPress={handleDoubleTap} className="relative">
          <Image
            source={{ uri: heroImage }}
            className="w-full h-80"
            resizeMode="cover"
          />

          {/* Status badge */}
          {item.status && item.status !== 'available' && (
            <View className="absolute top-3 right-3 bg-black/70 px-3 py-1 rounded-full">
              <Text className="font-sans text-xs text-white font-semibold">
                {item.status === 'traded' ? '✓ Razmenjeno' : '⏳ U razmeni'}
              </Text>
            </View>
          )}

          {/* Animirano srce za dupli tap */}
          <Animated.View
            style={{
              transform: [{ scale: heartScale }],
              opacity: heartScale,
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            pointerEvents="none"
          >
            <View className="w-24 h-24 bg-white rounded-full justify-center items-center opacity-90">
              <Text className="text-6xl">❤️</Text>
            </View>
          </Animated.View>
        </Pressable>

        {/* Item Info */}
        <View className="p-4">
          <Text className="font-display text-ink-dark text-lg mb-1" numberOfLines={1}>
            {item.title}
          </Text>

          <Text className="font-sans text-ink-dark opacity-60 text-sm mb-3">
            {item.brand} • {item.size.toUpperCase()}
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Image
                source={{
                  uri: item.userId.photoURL || 'https://via.placeholder.com/30',
                }}
                className="w-8 h-8 rounded-full mr-2"
              />
              <Text className="font-sans text-ink-dark text-sm" numberOfLines={1}>
                {item.userId.displayName}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onLike}
              className={`flex-row items-center px-3 py-2 rounded-full ${
                item.isLiked ? 'bg-brand-accent-deep' : 'bg-brand-accent-light'
              }`}
              activeOpacity={0.7}
            >
              <Text className="text-base mr-1">{item.isLiked ? '❤️' : '🤍'}</Text>
              <Text
                className={`font-sans text-sm ${
                  item.isLiked ? 'text-white' : 'text-ink-dark'
                }`}
              >
                {item.likesCount ?? 0}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
})
