import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import client from '@/api/client'

const { width } = Dimensions.get('window')
const CARD_WIDTH = width * 0.7

type FeedItem = {
  _id: string
  title: string
  brand: string
  size: string
  imageUrl: string
  price?: number
  user: {
    displayName: string
  }
}

export default function SuccessScreen() {
  const router = useRouter()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPersonalizedItems()
  }, [])

  const fetchPersonalizedItems = async () => {
    try {
      const response = await client.get('/api/feed?limit=3')
      if (response.data.ok) {
        setItems(response.data.data)
      }
    } catch (error) {
      console.error('[Success] Failed to fetch items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExplore = () => {
    router.replace('/(tabs)/feed')
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <StatusBar barStyle="dark-content" />

      {/* Progress Bar - 100% */}
      <View className="px-6 pt-16 pb-4">
        <View className="h-2 bg-ink-dark/10 rounded-full overflow-hidden">
          <View className="h-full bg-brand-accent-deep rounded-full" style={{ width: '100%' }} />
        </View>
      </View>

      <View className="flex-1 px-6 py-8">
        {/* Hero Section */}
        <View className="items-center mb-8">
          <View className="bg-brand-highlight rounded-full w-20 h-20 items-center justify-center mb-4">
            <Ionicons name="checkmark" size={48} color="#2B2A2B" />
          </View>
          <Text className="text-4xl font-display text-ink-dark mb-3 text-center">
            Tvoj profil je spreman! 🎉
          </Text>
          <Text className="text-base font-sans text-ink-dark/70 text-center px-4">
            Evo nekoliko garderobi koje smo odabrali baš za tebe
          </Text>
        </View>

        {/* Personalized Items Preview */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#431A43" />
          </View>
        ) : items.length > 0 ? (
          <FlatList
            data={items}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 16}
            decelerationRate="fast"
            contentContainerStyle={{
              paddingHorizontal: (width - CARD_WIDTH) / 2,
            }}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View
                className="bg-white rounded-3xl overflow-hidden mr-4 shadow-lg"
                style={{ width: CARD_WIDTH }}
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  className="w-full bg-ink-dark/5"
                  style={{ height: CARD_WIDTH * 1.3 }}
                  resizeMode="cover"
                />
                <View className="p-4">
                  <Text className="text-xl font-display text-ink-dark mb-2">
                    {item.title}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-sm font-sans text-ink-dark/70">
                        {item.brand} • {item.size}
                      </Text>
                      <Text className="text-xs font-sans text-ink-dark/50 mt-1">
                        {item.user.displayName}
                      </Text>
                    </View>
                    {item.price && (
                      <Text className="text-lg font-sans font-bold text-brand-accent-deep">
                        {item.price} RSD
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="sparkles-outline" size={64} color="#2B2A2B" />
            <Text className="text-lg font-sans text-ink-dark/70 mt-4 text-center">
              Spremni smo da te povežemo sa najboljim ponudama!
            </Text>
          </View>
        )}
      </View>

      {/* CTA Button */}
      <View className="px-6 pb-12 pt-4">
        <TouchableOpacity
          className="bg-brand-accent-deep rounded-full py-5 items-center shadow-lg"
          onPress={handleExplore}
        >
          <Text className="font-sans text-lg font-bold text-base-canvas">
            Istraži Sve ✨
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
