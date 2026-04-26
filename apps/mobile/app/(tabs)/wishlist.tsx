import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  RefreshControl,
  Alert,
  FlatList,
  TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import client from '@/api/client'
import { BrandBackground } from '@/components/BrandBackground'
import { BrandedLoader } from '@/components/BrandedLoader'
import { GlassSurface } from '@/components/GlassSurface'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { DiscoveryCardItem, DiscoveryItemCard } from '@/components/DiscoveryItemCard'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'
import { getApiErrorMessage } from '@/lib/apiErrors'

type WishlistItem = DiscoveryCardItem & {
  isWishlisted?: boolean
}

export default function WishlistScreen() {
  const router = useRouter()
  const { locale } = useI18n()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const copy = {
    sr: {
      title: 'Sacuvano',
      mood: 'moodboard',
      description: 'Tvoj privatni board komada kojima zelis da se vratis kada raspolozenje klikne.',
      emptyTitle: 'Nema jos sacuvanih komada',
      emptyDescription:
        'Kada te neki komad pogodi, sacuvaj ga i ovde ces graditi svoj licni discovery board.',
      emptyAction: 'Nazad na feed',
      badge: 'Sacuvano',
      loading: 'Velve slaze tvoj moodboard',
      loadError: 'Nije moguce ucitati sacuvane objave.',
      removeError: 'Nije moguce ukloniti item iz sacuvanih.',
    },
    en: {
      title: 'Saved',
      mood: 'moodboard',
      description: 'Your private board of pieces you want to return to when the mood clicks.',
      emptyTitle: 'No saved pieces yet',
      emptyDescription:
        'When a piece hits the right note, save it and this space will become your personal discovery board.',
      emptyAction: 'Back to feed',
      badge: 'Saved',
      loading: 'Velve is arranging your moodboard',
      loadError: 'Unable to load saved listings.',
      removeError: 'Unable to remove the item from saved.',
    },
    ru: {
      title: 'Сохраненное',
      mood: 'moodboard',
      description: 'Твоя личная доска вещей, к которым хочется возвращаться, когда настроение совпадает.',
      emptyTitle: 'Пока нет сохраненных вещей',
      emptyDescription:
        'Когда какая-то вещь попадает в твой вайб, сохрани ее, и это место станет твоим личным discovery-board.',
      emptyAction: 'Назад в ленту',
      badge: 'Сохранено',
      loading: 'Velve собирает твой moodboard',
      loadError: 'Не удалось загрузить сохраненные объявления.',
      removeError: 'Не удалось убрать вещь из сохраненного.',
    },
  } as const

  const fetchWishlist = async () => {
    try {
      const response = await client.get('/api/wishlist')
      if (response.data.ok) {
        setItems(
          (response.data.data as WishlistItem[]).filter(
            (item) => !item.status || item.status === 'available'
          )
        )
        setErrorMessage('')
      }
    } catch (error: any) {
      console.error('[Wishlist] Error:', error.message)
      setErrorMessage(getApiErrorMessage(error, copy[locale].loadError))
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
      setItems((prev) => prev.filter((item) => item._id !== itemId))
    } catch {
      Alert.alert('Velve', copy[locale].removeError)
    }
  }

  if (loading) {
    return <BrandedLoader label={copy[locale].loading} />
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <BrandBackground />

      <View className="px-5 pb-4 pt-16">
        <Text className="font-logo text-[30px] leading-none text-brand-accent-deep/70">
          {copy[locale].mood}
        </Text>
        <GlassSurface className="mt-4 px-5 py-5">
          <Text className="font-display text-3xl text-ink-dark">{copy[locale].title}</Text>
          <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/62">
            {copy[locale].description}
          </Text>
        </GlassSurface>
      </View>

      {errorMessage ? (
        <View className="px-4 pt-4">
          <EditorialEmptyState
            icon="cloud-offline-outline"
            title="Sacuvano nije ucitano"
            description={errorMessage}
            actionLabel="Pokusaj ponovo"
            onAction={fetchWishlist}
          />
        </View>
      ) : items.length === 0 ? (
        <View className="px-4 pt-4">
          <EditorialEmptyState
            icon="bookmark-outline"
            title={copy[locale].emptyTitle}
            description={copy[locale].emptyDescription}
            actionLabel={copy[locale].emptyAction}
            onAction={() => router.push('/(tabs)/feed')}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <DiscoveryItemCard
                item={item}
                badgeText={copy[locale].badge}
                onPress={() => router.push(`/items/${item._id}`)}
              />

              <TouchableOpacity
                className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full bg-base-canvas/90"
                onPress={() => handleRemove(item._id)}
              >
                <Ionicons name="bookmark" size={18} color={colors.accentDeep} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  )
}
