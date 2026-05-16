import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/lib/velveAlert'
import {
  View,
  Text,
  RefreshControl,
  FlatList,
  ScrollView,
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
  price?: number
  category?: string
  size?: string
}

type WishlistSort = 'recent' | 'price_low' | 'price_high'
const ALL_FILTER = '__all__'

export default function WishlistScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER)
  const [sizeFilter, setSizeFilter] = useState(ALL_FILTER)
  const [sortMode, setSortMode] = useState<WishlistSort>('recent')


  const categories = useMemo(() => {
    const unique = [...new Set(items.map((item) => item.category).filter(Boolean) as string[])]
    return [ALL_FILTER, ...unique.slice(0, 8)]
  }, [items])

  const sizes = useMemo(() => {
    const unique = [...new Set(items.map((item) => item.size).filter(Boolean) as string[])]
    return [ALL_FILTER, ...unique.slice(0, 8)]
  }, [items])

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const matchesCategory = categoryFilter === ALL_FILTER || item.category === categoryFilter
      const matchesSize = sizeFilter === ALL_FILTER || item.size === sizeFilter
      return matchesCategory && matchesSize
    })

    return [...filtered].sort((a, b) => {
      if (sortMode === 'price_low') return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER)
      if (sortMode === 'price_high') return (b.price ?? -1) - (a.price ?? -1)
      return 0
    })
  }, [categoryFilter, items, sizeFilter, sortMode])

  const fetchWishlist = async () => {
    try {
      const response = await client.get('/api/wishlist', { params: { limit: 50 } })
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
      setErrorMessage(getApiErrorMessage(error, t('wishlist.loadError')))
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
    Alert.alert(t('wishlist.removeTitle'), t('wishlist.removeDescription'), [
      { text: t('common.remove'), style: 'destructive', onPress: async () => {
        try {
          await client.delete(`/api/wishlist/${itemId}`)
          setItems((prev) => prev.filter((item) => item._id !== itemId))
        } catch {
          Alert.alert(t('common.error'), t('wishlist.removeError'))
        }
      } },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  if (loading) {
    return <BrandedLoader label={t('wishlist.loading')} />
  }

  return (
    <View className="flex-1 bg-base-canvas">
      <BrandBackground />

      <View className="px-5 pb-4 pt-16">
        <Text className="font-logo text-[30px] leading-none text-brand-accent-deep/70">
            {t('wishlist.mood')}
        </Text>
        <GlassSurface className="mt-4 px-5 py-5">
          <Text className="font-display text-3xl text-ink-dark">{t('wishlist.title')}</Text>
          <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/62">
            {t('wishlist.description')}
          </Text>
        </GlassSurface>
      </View>

      {errorMessage ? (
        <View className="px-4 pt-4">
          <EditorialEmptyState
            icon="cloud-offline-outline"
            title={t('wishlist.errorTitle')}
            description={errorMessage}
            actionLabel={t('common.retry')}
            onAction={fetchWishlist}
          />
        </View>
      ) : items.length === 0 ? (
        <View className="px-4 pt-4">
          <EditorialEmptyState
            icon="bookmark-outline"
            title={t('wishlist.emptyTitle')}
            description={t('wishlist.emptyDescription')}
            actionLabel={t('wishlist.emptyAction')}
            onAction={() => router.push('/(tabs)/feed')}
          />
        </View>
      ) : (
        <>
        <View className="px-5 pb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            <View className="flex-row gap-2 pr-5">
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setCategoryFilter(category)}
                  className={`rounded-full px-4 py-2.5 ${
                    categoryFilter === category ? 'bg-brand-accent-deep' : 'bg-surface-panel'
                  }`}
                >
                  <Text
                    className={`font-sans text-sm ${
                      categoryFilter === category ? 'text-base-canvas' : 'text-ink-dark/65'
                    }`}
                  >
                    {category === ALL_FILTER ? t('wishlist.allFilter') : category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2 pr-5">
              {sizes.map((size) => (
                <TouchableOpacity
                  key={size}
                  onPress={() => setSizeFilter(size)}
                  className={`rounded-full px-4 py-2.5 ${
                    sizeFilter === size ? 'bg-brand-accent-light/40' : 'bg-surface-panel'
                  }`}
                >
                  <Text className="font-sans text-sm text-ink-dark">{size === ALL_FILTER ? t('wishlist.allFilter') : size}</Text>
                </TouchableOpacity>
              ))}
              {([
                ['recent', t('wishlist.sortRecent')],
                ['price_low', t('wishlist.sortPriceLow')],
                ['price_high', t('wishlist.sortPriceHigh')],
              ] as const).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setSortMode(value)}
                  className={`rounded-full px-4 py-2.5 ${
                    sortMode === value ? 'bg-brand-highlight/50' : 'bg-surface-panel'
                  }`}
                >
                  <Text className="font-sans text-sm text-ink-dark">{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {visibleItems.length === 0 ? (
          <View className="px-4 pt-4">
            <EditorialEmptyState
              icon="filter-outline"
              title={t('wishlist.filterEmptyTitle')}
              description={t('wishlist.filterEmptyDescription')}
              actionLabel={t('wishlist.clearFilters')}
              onAction={() => {
                setCategoryFilter(ALL_FILTER)
                setSizeFilter(ALL_FILTER)
                setSortMode('recent')
              }}
            />
          </View>
        ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <DiscoveryItemCard
                item={item}
                badgeText={t('wishlist.badge')}
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
        </>
      )}
    </View>
  )
}
