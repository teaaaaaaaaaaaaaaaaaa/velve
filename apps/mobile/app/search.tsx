import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import client from '@/api/client'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { ImmersiveFeedCard, ImmersiveFeedItem } from '@/components/ImmersiveFeedCard'
import { VelveTextInput } from '@/components/VelveTextInput'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'
import { getApiErrorMessage } from '@/lib/apiErrors'
import { getStorage } from '@/lib/storage'
import { showVelveToast } from '@/lib/velveAlert'

type SearchFilters = {
  category: string
  size: string
  city: string
  priceMin: string
  priceMax: string
}

const EMPTY_FILTERS: SearchFilters = {
  category: '',
  size: '',
  city: '',
  priceMin: '',
  priceMax: '',
}

const SIZE_FILTERS = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const SEARCH_HISTORY_KEY = '@velve:search-history'

export default function SearchScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ category?: string; q?: string }>()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { locale, t } = useI18n()
  const categoryFilters = [
    t('search.categoryTops'),
    t('search.categoryDresses'),
    t('search.categoryPants'),
    t('search.categoryOuterwear'),
    t('search.categoryShoes'),
    t('search.categoryAccessories'),
  ]
  const trendingTags = [
    t('search.trendingLeather'),
    t('search.trendingDenim'),
    t('search.trendingSamba'),
    t('search.trendingCoat'),
    t('search.trendingBlackBag'),
    t('search.trendingBlazer'),
  ]

  const [query, setQuery] = useState(params.q || '')
  const [items, setItems] = useState<ImmersiveFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const initialFilters = { ...EMPTY_FILTERS, category: params.category || '' }
  const [filters, setFilters] = useState<SearchFilters>(initialFilters)
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(initialFilters)
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  const pageHeight = Math.max(windowHeight, 1)

  const updateItem = useCallback((itemId: string, updater: (item: ImmersiveFeedItem) => ImmersiveFeedItem) => {
    setItems((prev) => prev.map((item) => (item._id === itemId ? updater(item) : item)))
  }, [])

  useEffect(() => {
    getStorage()
      .getItem(SEARCH_HISTORY_KEY)
      .then((value) => {
        if (!value) return
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed.filter((entry) => typeof entry === 'string').slice(0, 8))
        }
      })
      .catch(() => undefined)
  }, [])

  const persistSearchHistory = useCallback((nextHistory: string[]) => {
    setSearchHistory(nextHistory)
    getStorage().setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory)).catch(() => undefined)
  }, [])

  const recordSearchQuery = useCallback(
    (value: string) => {
      const normalized = value.trim()
      if (normalized.length < 2) return
      const nextHistory = [
        normalized,
        ...searchHistory.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase()),
      ].slice(0, 8)
      persistSearchHistory(nextHistory)
    },
    [persistSearchHistory, searchHistory]
  )

  const useSuggestion = useCallback(
    (value: string) => {
      setQuery(value)
      recordSearchQuery(value)
    },
    [recordSearchQuery]
  )

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
            category: filters.category || undefined,
            size: filters.size || undefined,
            city: filters.city.trim() || undefined,
            priceMin: filters.priceMin.trim() || undefined,
            priceMax: filters.priceMax.trim() || undefined,
            cursor: mode === 'append' ? nextCursor || undefined : undefined,
          },
        })

        if (response.data.ok) {
          const nextItems = response.data.data as ImmersiveFeedItem[]
          setItems((prev) => (mode === 'append' ? [...prev, ...nextItems] : nextItems))
          setNextCursor(response.data.nextCursor ? String(response.data.nextCursor) : null)
          setHasMore(Boolean(response.data.hasMore))
          setErrorMessage('')
          return
        }

        throw new Error('INVALID_SEARCH_RESPONSE')
      } catch (error) {
        if (mode === 'replace') {
          setItems([])
          setErrorMessage(getApiErrorMessage(error, t('search.loadError')))
        } else {
          showVelveToast({
            title: t('search.loadMoreErrorTitle'),
            message: getApiErrorMessage(error, t('search.loadMoreErrorDescription')),
            tone: 'error',
          })
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [filters, nextCursor, query, t]
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
        showVelveToast({
          title: t('search.likeErrorTitle'),
          message: t('search.likeErrorDescription'),
          tone: 'error',
        })
      }
    },
    [t, updateItem]
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
        showVelveToast({
          title: t('search.saveErrorTitle'),
          message: t('search.saveErrorDescription'),
          tone: 'error',
        })
      }
    },
    [t, updateItem]
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
  const activeFilterCount = Object.values(filters).filter((value) => value.trim()).length

  const applyFilters = useCallback(() => {
    setFilters(draftFilters)
    setFilterOpen(false)
    setNextCursor(null)
  }, [draftFilters])

  const clearFilters = useCallback(() => {
    setDraftFilters(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setFilterOpen(false)
    setNextCursor(null)
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {loading && items.length === 0 ? (
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator color={colors.accentDeep} />
          <Text className="mt-3 font-sans text-sm text-ink-dark/45">{t('search.loading')}</Text>
        </View>
      ) : errorMessage && items.length === 0 ? (
        <View className="flex-1 bg-white px-5 pt-24">
          <EditorialEmptyState
            icon="cloud-offline-outline"
            title={t('search.errorTitle')}
            description={errorMessage}
            actionLabel={t('common.retry')}
            onAction={() => loadResults('replace')}
          />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 bg-white px-5 pt-24">
          <EditorialEmptyState
            icon="search-outline"
            title={t('feed.searchEmptyTitle')}
            description={t('feed.searchEmptyDescription')}
            actionLabel={t('feed.searchClear')}
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
                  <Text className="font-sans text-sm text-ink-dark/62">{t('common.loadingMore')}</Text>
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
              onSubmitEditing={() => recordSearchQuery(query)}
              placeholder={t('search.placeholder')}
              className="ml-3 flex-1 font-sans text-sm text-ink-dark"
              autoFocus
            />
          </View>
          <TouchableOpacity
            onPress={() => {
              setDraftFilters(filters)
              setFilterOpen(true)
            }}
            className={`h-11 w-11 items-center justify-center rounded-full ${
              activeFilterCount ? 'bg-brand-accent-deep' : 'bg-ink-dark/6'
            }`}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount ? colors.baseCanvas : colors.inkDark}
            />
          </TouchableOpacity>
        </View>

        {!loading ? (
          <View className="mt-3 self-start rounded-full border border-ink-dark/8 bg-ink-dark/4 px-3 py-2">
            <Text className="font-sans text-xs font-semibold text-ink-dark/62">
              {t('feed.resultsCount', { count: items.length })}
            </Text>
          </View>
        ) : null}
      </View>

      {!query.trim() ? (
        <View
          className="absolute left-4 right-4 z-10 rounded-[24px] bg-base-canvas/95 px-4 py-4"
          style={{ top: insets.top + 78 }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="font-sans text-xs uppercase tracking-[1.1px] text-ink-dark/45">
              {t('search.trending')}
            </Text>
            {searchHistory.length > 0 ? (
              <TouchableOpacity onPress={() => persistSearchHistory([])}>
                <Text className="font-sans text-xs font-semibold text-brand-accent-deep">{t('search.clearHistory')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {trendingTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => useSuggestion(tag)}
                className="rounded-full bg-brand-highlight/35 px-3 py-2"
              >
                <Text className="font-sans text-xs font-semibold text-ink-dark">{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {searchHistory.length > 0 ? (
            <View className="mt-4">
              <Text className="font-sans text-xs uppercase tracking-[1.1px] text-ink-dark/45">
                {t('search.previous')}
              </Text>
              <View className="mt-2 gap-2">
                {searchHistory.slice(0, 4).map((entry) => (
                  <TouchableOpacity
                    key={entry}
                    onPress={() => useSuggestion(entry)}
                    className="flex-row items-center rounded-[18px] bg-surface-panel px-3 py-3"
                  >
                    <Ionicons name="time-outline" size={16} color={colors.mutedText} />
                    <Text className="ml-2 flex-1 font-sans text-sm text-ink-dark">{entry}</Text>
                    <Ionicons name="arrow-up-outline" size={14} color={colors.mutedText} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View className="flex-1 justify-end bg-ink-dark/30">
          <View className="rounded-t-[32px] bg-base-canvas px-5 pb-8 pt-5">
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="font-display text-3xl text-ink-dark">{t('search.filters')}</Text>
              <TouchableOpacity
                onPress={() => setFilterOpen(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface-panel"
              >
                <Ionicons name="close" size={20} color={colors.inkDark} />
              </TouchableOpacity>
            </View>

            <Text className="mb-2 font-sans text-xs uppercase tracking-[1.1px] text-ink-dark/45">
              {t('search.category')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {categoryFilters.map((category) => (
                <TouchableOpacity
                  key={category}
                  onPress={() =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      category: prev.category === category ? '' : category,
                    }))
                  }
                  className={`rounded-full px-4 py-2.5 ${
                    draftFilters.category === category ? 'bg-brand-accent-deep' : 'bg-surface-panel'
                  }`}
                >
                  <Text
                    className={`font-sans text-sm ${
                      draftFilters.category === category ? 'text-base-canvas' : 'text-ink-dark'
                    }`}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="mb-2 mt-5 font-sans text-xs uppercase tracking-[1.1px] text-ink-dark/45">
              {t('search.size')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SIZE_FILTERS.map((size) => (
                <TouchableOpacity
                  key={size}
                  onPress={() =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      size: prev.size === size ? '' : size,
                    }))
                  }
                  className={`min-w-[48px] items-center rounded-full px-4 py-2.5 ${
                    draftFilters.size === size ? 'bg-brand-accent-deep' : 'bg-surface-panel'
                  }`}
                >
                  <Text
                    className={`font-sans text-sm ${
                      draftFilters.size === size ? 'text-base-canvas' : 'text-ink-dark'
                    }`}
                  >
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="mt-5 flex-row gap-3">
              <VelveTextInput
                value={draftFilters.city}
                onChangeText={(city) => setDraftFilters((prev) => ({ ...prev, city }))}
                placeholder={t('search.cityPlaceholder')}
                className="flex-1 rounded-[20px] bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
              <VelveTextInput
                value={draftFilters.priceMin}
                onChangeText={(priceMin) => setDraftFilters((prev) => ({ ...prev, priceMin }))}
                placeholder={t('search.priceMinPlaceholder')}
                keyboardType="numeric"
                className="flex-1 rounded-[20px] bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
              <VelveTextInput
                value={draftFilters.priceMax}
                onChangeText={(priceMax) => setDraftFilters((prev) => ({ ...prev, priceMax }))}
                placeholder={t('search.priceMaxPlaceholder')}
                keyboardType="numeric"
                className="flex-1 rounded-[20px] bg-surface-panel px-4 py-4 font-sans text-sm text-ink-dark"
              />
            </View>

            <View className="mt-6 flex-row gap-3">
              <TouchableOpacity
                onPress={clearFilters}
                className="flex-1 items-center rounded-full bg-surface-panel px-4 py-4"
              >
                <Text className="font-sans text-sm font-semibold text-ink-dark">{t('common.clear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyFilters}
                className="flex-1 items-center rounded-full bg-brand-accent-deep px-4 py-4"
              >
                <Text className="font-sans text-sm font-semibold text-base-canvas">{t('common.apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
