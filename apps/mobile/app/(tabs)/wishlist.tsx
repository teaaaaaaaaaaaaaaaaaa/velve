import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import client from '@/api/client'

interface WishlistItem {
  _id: string
  itemId: {
    _id: string
    title: string
    images: string[]
    brand: string
    size: string
    condition: string
    userId: {
      displayName: string
    }
  }
  createdAt: string
}

export default function WishlistScreen() {
  const router = useRouter()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchWishlist = async () => {
    try {
      const response = await client.get('/api/wishlist')
      if (response.data.ok) {
        setItems(response.data.data)
      }
    } catch (error: any) {
      console.error('[Wishlist] Error:', error.message)
      Alert.alert('Greška', 'Nije moguće učitati wishlist')
    }
  }

  useEffect(() => {
    fetchWishlist().finally(() => setLoading(false))
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchWishlist()
    setRefreshing(false)
  }, [])

  const handleRemove = async (itemId: string) => {
    try {
      await client.delete(`/api/wishlist/${itemId}`)
      setItems((prev) => prev.filter((item) => item.itemId?._id !== itemId))
    } catch (error: any) {
      Alert.alert('Greška', 'Nije moguće ukloniti iz wishlist-a')
    }
  }

  const renderItem = ({ item }: { item: WishlistItem }) => {
    const itemData = item.itemId
    if (!itemData) return null

    return (
      <TouchableOpacity
        onPress={() => router.push(`/items/${itemData._id}`)}
        className="flex-row bg-white rounded-2xl mb-3 p-3 shadow-sm"
        activeOpacity={0.7}
      >
        {/* Image */}
        <Image
          source={{ uri: itemData.images[0] || 'https://via.placeholder.com/100' }}
          className="w-24 h-24 rounded-xl mr-3"
          resizeMode="cover"
        />

        {/* Info */}
        <View className="flex-1">
          <Text className="font-display text-base text-ink-dark" numberOfLines={2}>
            {itemData.title}
          </Text>
          <Text className="font-sans text-sm text-ink-dark/60 mt-1">
            {itemData.brand} • {itemData.size}
          </Text>
          <Text className="font-sans text-xs text-ink-dark/40 mt-1">
            {itemData.userId?.displayName}
          </Text>
        </View>

        {/* Remove button */}
        <TouchableOpacity
          onPress={() => handleRemove(itemData._id)}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="bookmark" size={24} color="#431A43" />
        </TouchableOpacity>
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
        <Text className="font-display text-2xl text-ink-dark">Sačuvano</Text>
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="bookmark-outline" size={64} color="#2B2A2B" style={{ opacity: 0.2 }} />
          <Text className="font-display text-lg text-ink-dark mt-4">Nema sačuvanih itema</Text>
          <Text className="font-sans text-sm text-ink-dark/50 text-center mt-2">
            Dodaj iteme u wishlist pritiskom na 🔖 dugme.
          </Text>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  )
}
