import { Ionicons } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import client from '@/api/client'
import { BrandedLoader } from '@/components/BrandedLoader'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { ImmersiveFeedCard, ImmersiveFeedItem } from '@/components/ImmersiveFeedCard'
import { VelveTextInput } from '@/components/VelveTextInput'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'

export default function SearchScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { locale } = useI18n()

  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ImmersiveFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const pageHeight = Math.max(windowHeight, 1)

  const updateItem = useCallback((itemId: string, updater: (item: ImmersiveFeedItem) => ImmersiveFeedItem) => {
    setItems((prev) => prev.map((item) => (item._id === itemId ? updater(item) : item)))
  }, [])

  const loadResults = useCallback(
    async (mode: 'replace' | 'append' = 'replace') => {
      try {
        if (mode === 'replace') {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }

        const response = await client.get('/api/items', {
          params: {
            limit: 20,
            search: query.trim() || undefined,
            cursor: mode === 'append' ? nextCursor || undefined : undefined,
          },
        })

        if (response.data.ok) {
          const nextItems = response.data.data as ImmersiveFeedItem[]
          setItems((prev) => (mode === 'append' ? [...prev, ...nextItems] : nextItems))
          setNextCursor(response.data.nextCursor ? String(response.data.nextCursor) : null)
          setHasMore(Boolean(response.data.hasMore))
        }
      } catch {
        if (mode === 'replace') {
          setItems([])
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [nextCursor, query]
  )

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadResults('replace')
    }, 250)

    return () => clearTimeout(timeout)
  }, [loadResults])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadResults('replace')
  }, [loadResults])

  const onLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || !nextCursor) return
    loadResults('append')
  }, [hasMore, loadResults, loadingMore, nextCursor])

  const handleLike = useCallback(
    async (itemId: string, isLiked: boolean) => {
      let previousCount = 0

      updateItem(itemId, (item) => {
        previousCount = item.likesCount ?? 0
        return {
          ...item,
          isLiked: !isLiked,
          likesCount: (item.likesCount ?? 0) + (isLiked ? -1 : 1),
        }
      })

      try {
        const response = isLiked
          ? await client.delete(`/api/items/${itemId}/like`)
          : await client.post(`/api/items/${itemId}/like`)

        if (!isLiked && response.data.ok) {
          updateItem(itemId, (item) => ({
            ...item,
            isLiked: response.data.isLiked,
            likesCount: response.data.likesCount,
          }))
        }
      } catch {
        updateItem(itemId, (item) => ({
          ...item,
          isLiked,
          likesCount: previousCount,
        }))
      }
    },
    [updateItem]
  )

  const handleWishlist = useCallback(
    async (itemId: string, isWishlisted: boolean) => {
      let previousCount = 0

      updateItem(itemId, (item) => {
        previousCount = item.wishlistCount ?? 0
        return {
          ...item,
          isWishlisted: !isWishlisted,
          wishlistCount: (item.wishlistCount ?? 0) + (isWishlisted ? -1 : 1),
        }
      })

      try {
        if (isWishlisted) {
          await client.delete(`/api/wishlist/${itemId}`)
        } else {
          await client.post(`/api/wishlist/${itemId}`)
        }
      } catch {
        updateItem(itemId, (item) => ({
          ...item,
          isWishlisted,
          wishlistCount: previousCount,
        }))
      }
    },
    [updateItem]
  )

  const renderSearchItem = useCallback(
    ({ item }: { item: ImmersiveFeedItem }) => (
      <ImmersiveFeedCard
        item={item}
        height={pageHeight}
        locale={locale}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onLike={handleLike}
        onWishlist={handleWishlist}
      />
    ),
    [handleLike, handleWishlist, insets.bottom, insets.top, locale, pageHeight]
  )

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 })

  if (loading && items.length === 0) {
    return <BrandedLoader dark />
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {items.length === 0 ? (
        <View className="flex-1 bg-white px-5 pt-24">
          <EditorialEmptyState
            icon="search-outline"
            title="Nema rezultata za ovaj upit"
            description="Probaj drugi naziv, brend ili kategoriju i feed ce odmah pokazati novi set komada."
            actionLabel="Obrisi unos"
            onAction={() => setQuery('')}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderSearchItem}
          showsVerticalScrollIndicator={false}
          pagingEnabled
          decelerationRate="fast"
          snapToInterval={pageHeight}
          snapToAlignment="start"
          disableIntervalMomentum
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews
          viewabilityConfig={viewabilityConfig.current}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.55}
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListFooterComponent={
            loadingMore ? (
              <View className="py-8">
                <View className="mx-auto rounded-full border border-ink-dark/8 bg-ink-dark/4 px-5 py-3">
                  <Text className="font-sans text-sm text-ink-dark/62">Loading more...</Text>
                </View>
              </View>
            ) : null
          }
        />
      )}

      <View className="absolute left-4 right-4 z-10" style={{ top: insets.top + 10 }}>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-ink-dark/6"
          >
            <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
          </TouchableOpacity>

          <View className="flex-1 flex-row items-center rounded-full bg-ink-dark/6 px-4 py-3">
            <Ionicons name="search" size={18} color={colors.inkDark} style={{ opacity: 0.5 }} />
            <VelveTextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Pretrazi komade, brend ili kategoriju..."
              className="ml-3 flex-1 font-sans text-sm text-ink-dark"
              autoFocus
            />
          </View>
        </View>

        {!loading ? (
          <View className="mt-3 self-start rounded-full border border-ink-dark/8 bg-ink-dark/4 px-3 py-2">
            <Text className="font-sans text-xs font-semibold text-ink-dark/62">
              {items.length} rezultata
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  )
}
