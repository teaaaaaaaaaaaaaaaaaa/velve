import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import client from '@/api/client'
import { BrandedLoader, FeedSkeleton } from '@/components/BrandedLoader'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { BrandWordmark } from '@/components/BrandWordmark'
import { ImmersiveFeedCard, ImmersiveFeedItem } from '@/components/ImmersiveFeedCard'
import { VelveTextInput, type VelveTextInputRef } from '@/components/VelveTextInput'
import { colors } from '@/design/tokens'
import { useI18n } from '@/i18n'
import { prefetchImageUri } from '@/lib/expoImage'
import { getApiErrorMessage } from '@/lib/apiErrors'
import { getPrimaryItemImage } from '@/lib/itemImages'
import { normalizeImageUri } from '@/lib/images'

type FeedMode = 'for_you' | 'following'

function dedupeItemsById(items: ImmersiveFeedItem[]) {
  const seen = new Set<string>()

  return items.filter((item) => {
    const itemId = String(item._id)
    if (seen.has(itemId)) return false
    seen.add(itemId)
    return true
  })
}

export default function FeedScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const { locale, t } = useI18n()

  const [items, setItems] = useState<ImmersiveFeedItem[]>([])
  const [feedMode, setFeedMode] = useState<FeedMode>('for_you')
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [actionItem, setActionItem] = useState<ImmersiveFeedItem | null>(null)
  const [feedError, setFeedError] = useState('')
  const feedInFlightKeysRef = useRef(new Set<string>())
  const feedRequestVersionRef = useRef(0)
  const feedModeRef = useRef(feedMode)
  const firstTimeFeedRef = useRef(true)
  feedModeRef.current = feedMode

  // --- Inline search state ---
  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchItems, setSearchItems] = useState<ImmersiveFeedItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchLoadingMore, setSearchLoadingMore] = useState(false)
  const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const searchInputRef = useRef<VelveTextInputRef>(null)

  const openSearch = useCallback(() => {
    setSearchActive(true)
    setSearchLoading(true)
    setTimeout(() => searchInputRef.current?.focus(), 120)
  }, [])

  const finishCloseSearch = useCallback(() => {
    setSearchActive(false)
    setSearchQuery('')
    setSearchItems([])
    setSearchNextCursor(null)
  }, [])

  const closeSearch = useCallback(() => {
    searchInputRef.current?.blur()
    finishCloseSearch()
  }, [finishCloseSearch])

  // Search data fetching
  const loadSearchResults = useCallback(
    async (mode: 'replace' | 'append' = 'replace') => {
      try {
        if (mode === 'replace') setSearchLoading(true)
        else setSearchLoadingMore(true)

        const response = await client.get('/api/items', {
          params: {
            limit: 20,
            search: searchQuery.trim() || undefined,
            cursor: mode === 'append' ? searchNextCursor || undefined : undefined,
          },
        })

        if (response.data.ok) {
          const nextItems = response.data.data as ImmersiveFeedItem[]
          setSearchItems((prev) => (mode === 'append' ? [...prev, ...nextItems] : nextItems))
          setSearchNextCursor(response.data.nextCursor ? String(response.data.nextCursor) : null)
          setSearchHasMore(Boolean(response.data.hasMore))
        }
      } catch {
        if (mode === 'replace') setSearchItems([])
      } finally {
        setSearchLoading(false)
        setSearchLoadingMore(false)
      }
    },
    [searchNextCursor, searchQuery]
  )

  // Debounced search trigger
  useEffect(() => {
    if (!searchActive) return
    const timeout = setTimeout(() => loadSearchResults('replace'), 250)
    return () => clearTimeout(timeout)
  }, [searchQuery, searchActive, loadSearchResults])

  const onSearchLoadMore = useCallback(() => {
    if (!searchHasMore || searchLoadingMore || !searchNextCursor) return
    loadSearchResults('append')
  }, [searchHasMore, loadSearchResults, searchLoadingMore, searchNextCursor])

  const pageHeight = Math.max(windowHeight, 1)

  const fetchFeed = useCallback(
    async (
      pageNum: number,
      mode: 'replace' | 'append' = 'replace',
      excludeIds: string[] = []
    ) => {
      const requestKey = `${feedMode}:${mode}:${pageNum}:${excludeIds.join('|')}`

      if (feedInFlightKeysRef.current.has(requestKey)) {
        if (mode === 'replace') setRefreshing(false)
        return
      }

      feedInFlightKeysRef.current.add(requestKey)
      const requestVersion =
        mode === 'replace' ? ++feedRequestVersionRef.current : feedRequestVersionRef.current
      const isCurrentRequest = () =>
        feedModeRef.current === feedMode && requestVersion === feedRequestVersionRef.current

      try {
        if (pageNum === 0 && mode === 'replace') setIsLoading(true)
        else setIsLoadingMore(true)

        const params: Record<string, string | number> = {
          limit: 10,
          page: mode === 'append' ? 0 : pageNum,
          mode: feedMode,
        }

        if (feedMode === 'for_you' && pageNum === 0 && firstTimeFeedRef.current) {
          params.firstTime = 'true'
        }

        if (mode === 'append' && excludeIds.length > 0) {
          params.excludeIds = excludeIds.join(',')
        }

        const response = await client.get('/api/feed', { params })

        if (response.data.ok) {
          if (!isCurrentRequest()) {
            return
          }

          const nextItems = dedupeItemsById(response.data.data as ImmersiveFeedItem[])
          setItems((prev) =>
            mode === 'append' ? dedupeItemsById([...prev, ...nextItems]) : nextItems
          )
          setHasMore(response.data.hasMore)
          setFeedError('')

          if (pageNum === 0 && firstTimeFeedRef.current) {
            firstTimeFeedRef.current = false
          }
        }
      } catch (error) {
        if (pageNum === 0 && isCurrentRequest()) {
          setItems([])
          setFeedError(getApiErrorMessage(error, 'Feed trenutno ne moze da se ucita.'))
        }
      } finally {
        feedInFlightKeysRef.current.delete(requestKey)
        if (isCurrentRequest()) {
          setIsLoading(false)
          setIsLoadingMore(false)
          setRefreshing(false)
        }
      }
    },
    [feedMode]
  )

  useEffect(() => {
    fetchFeed(0)
  }, [fetchFeed])

  useEffect(() => {
    items.slice(0, 3).forEach((item) => {
      const uri = normalizeImageUri(getPrimaryItemImage(item))
      if (uri && !prefetchedRef.current.has(uri)) {
        prefetchedRef.current.add(uri)
        void prefetchImageUri(uri)
      }
    })
  }, [items])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchFeed(0)
  }, [fetchFeed])

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || items.length === 0) return
    fetchFeed(0, 'append', items.map((item) => item._id))
  }, [fetchFeed, hasMore, isLoadingMore, items])

  const updateItem = useCallback((itemId: string, updater: (item: ImmersiveFeedItem) => ImmersiveFeedItem) => {
    setItems((prev) => prev.map((item) => (item._id === itemId ? updater(item) : item)))
  }, [])

  const handleLike = useCallback(
    async (itemId: string, isLiked: boolean) => {
      const previousLiked = isLiked
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
          isLiked: previousLiked,
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

  const handleHideItem = useCallback(async (item: ImmersiveFeedItem) => {
    try {
      await client.post(`/api/items/${item._id}/hide`, { reason: 'not_interested' })
      setItems((prev) => prev.filter((entry) => entry._id !== item._id))
      setActionItem(null)
    } catch {
      Alert.alert('Greška', 'Nije moguće sakriti ovu objavu.')
    }
  }, [])

  const handleReportItem = useCallback(async (item: ImmersiveFeedItem) => {
    try {
      await client.post(`/api/items/${item._id}/report`, { reason: 'community_report' })
      setActionItem(null)
      Alert.alert('Hvala', 'Prijava je poslata i pregledaćemo objavu.')
    } catch {
      Alert.alert('Greška', 'Nije moguće poslati prijavu trenutno.')
    }
  }, [])

  const handleBlockSeller = useCallback(async (item: ImmersiveFeedItem) => {
    try {
      await client.post(`/api/users/${item.userId._id}/block`)
      setItems((prev) => prev.filter((entry) => entry.userId._id !== item.userId._id))
      setActionItem(null)
      Alert.alert(
        'Korisnik blokiran',
        `Sadržaj korisnika @${item.userId.displayName} više ti se neće prikazivati.`
      )
    } catch {
      Alert.alert('Greška', 'Nije moguće blokirati korisnika trenutno.')
    }
  }, [])

  const prefetchedRef = useRef(new Set<string>())
  const itemsRef = useRef(items)
  itemsRef.current = items

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0 || viewableItems[0].index == null) return
      const currentIndex = viewableItems[0].index
      const currentItems = itemsRef.current
      for (let i = 1; i <= 2; i++) {
        const nextItem = currentItems[currentIndex + i]
        if (!nextItem) continue
        const uri = normalizeImageUri(getPrimaryItemImage(nextItem))
        if (uri && !prefetchedRef.current.has(uri)) {
          prefetchedRef.current.add(uri)
          void prefetchImageUri(uri)
        }
      }
    }
  )

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 })

  const renderFeedItem = useCallback(
    ({ item }: { item: ImmersiveFeedItem }) => (
      <ImmersiveFeedCard
        item={item}
        height={pageHeight}
        locale={locale}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onLike={handleLike}
        onWishlist={handleWishlist}
        onMore={setActionItem}
      />
    ),
    [handleLike, handleWishlist, insets.bottom, insets.top, locale, pageHeight]
  )

  // Search-specific item updater + handlers
  const updateSearchItem = useCallback(
    (itemId: string, updater: (item: ImmersiveFeedItem) => ImmersiveFeedItem) => {
      setSearchItems((prev) => prev.map((item) => (item._id === itemId ? updater(item) : item)))
    },
    []
  )

  const handleSearchLike = useCallback(
    async (itemId: string, isLiked: boolean) => {
      let previousCount = 0
      updateSearchItem(itemId, (item) => {
        previousCount = item.likesCount ?? 0
        return { ...item, isLiked: !isLiked, likesCount: (item.likesCount ?? 0) + (isLiked ? -1 : 1) }
      })
      try {
        const response = isLiked
          ? await client.delete(`/api/items/${itemId}/like`)
          : await client.post(`/api/items/${itemId}/like`)
        if (!isLiked && response.data.ok) {
          updateSearchItem(itemId, (item) => ({
            ...item,
            isLiked: response.data.isLiked,
            likesCount: response.data.likesCount,
          }))
        }
      } catch {
        updateSearchItem(itemId, (item) => ({ ...item, isLiked, likesCount: previousCount }))
      }
    },
    [updateSearchItem]
  )

  const handleSearchWishlist = useCallback(
    async (itemId: string, isWishlisted: boolean) => {
      let previousCount = 0
      updateSearchItem(itemId, (item) => {
        previousCount = item.wishlistCount ?? 0
        return { ...item, isWishlisted: !isWishlisted, wishlistCount: (item.wishlistCount ?? 0) + (isWishlisted ? -1 : 1) }
      })
      try {
        if (isWishlisted) await client.delete(`/api/wishlist/${itemId}`)
        else await client.post(`/api/wishlist/${itemId}`)
      } catch {
        updateSearchItem(itemId, (item) => ({ ...item, isWishlisted, wishlistCount: previousCount }))
      }
    },
    [updateSearchItem]
  )

  const renderSearchItem = useCallback(
    ({ item }: { item: ImmersiveFeedItem }) => (
      <ImmersiveFeedCard
        item={item}
        height={pageHeight}
        locale={locale}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onLike={handleSearchLike}
        onWishlist={handleSearchWishlist}
      />
    ),
    [handleSearchLike, handleSearchWishlist, insets.bottom, insets.top, locale, pageHeight]
  )

  const searchViewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 })

  if (isLoading) {
    return <FeedSkeleton />
  }

  return (
    <View className="flex-1 bg-surface-panel">
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {searchActive ? (
        // --- Search results overlay ---
        searchLoading && searchItems.length === 0 ? (
          <BrandedLoader showSpinner />
        ) : searchItems.length === 0 ? (
          <View className="flex-1 bg-surface-panel px-5 pt-24">
            <EditorialEmptyState
              icon="search-outline"
              title="Nema rezultata za ovaj upit"
              description="Probaj drugi naziv, brend ili kategoriju i feed ce odmah pokazati novi set komada."
              actionLabel="Obrisi unos"
              onAction={() => setSearchQuery('')}
            />
          </View>
        ) : (
          <FlatList
            data={searchItems}
            key="search"
            keyExtractor={(item) => `s-${item._id}`}
            renderItem={renderSearchItem}
            showsVerticalScrollIndicator={false}
            pagingEnabled
            decelerationRate="fast"
            disableIntervalMomentum
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            updateCellsBatchingPeriod={40}
            removeClippedSubviews={false}
            snapToInterval={pageHeight}
            snapToAlignment="start"
            viewabilityConfig={searchViewabilityConfig.current}
            onEndReached={onSearchLoadMore}
            onEndReachedThreshold={0.55}
            getItemLayout={(_, index) => ({
              length: pageHeight,
              offset: pageHeight * index,
              index,
            })}
            ListHeaderComponent={
              !searchLoading ? (
                <View className="absolute left-4 z-10" style={{ top: insets.top + 64 }}>
                  <View className="rounded-full border border-ink-dark/8 bg-ink-dark/4 px-3 py-2">
                    <Text className="font-sans text-xs font-semibold text-ink-dark/62">
                      {searchItems.length} rezultata
                    </Text>
                  </View>
                </View>
              ) : null
            }
            ListFooterComponent={
              searchLoadingMore ? (
                <View className="py-8">
                  <View className="mx-auto rounded-full border border-ink-dark/8 bg-ink-dark/4 px-5 py-3">
                    <Text className="font-sans text-sm text-ink-dark/62">Loading more...</Text>
                  </View>
                </View>
              ) : null
            }
          />
        )
      ) : feedError ? (
        <View className="flex-1 justify-center bg-surface-panel px-4 pt-20">
          <EditorialEmptyState
            icon="cloud-offline-outline"
            title="Feed nije ucitan"
            description={feedError}
            actionLabel="Pokusaj ponovo"
            onAction={() => fetchFeed(0)}
          />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 justify-center bg-surface-panel px-4 pt-20">
          <EditorialEmptyState
            icon={feedMode === 'following' ? 'people-outline' : 'sparkles-outline'}
            title={
              feedMode === 'following' ? 'Following feed je jos prazan' : t('feed.emptyTitle')
            }
            description={
              feedMode === 'following'
                ? 'Zapratite par profila i ovde ce se pojaviti samo njihovi komadi u istom feed ritmu.'
                : t('feed.emptyDescription')
            }
            actionLabel={feedMode === 'following' ? 'Predji na For You' : t('common.refresh')}
            onAction={() => {
              if (feedMode === 'following') {
                setFeedMode('for_you')
                return
              }
              fetchFeed(0)
            }}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          key={feedMode}
          keyExtractor={(item) => item._id}
          renderItem={renderFeedItem}
          showsVerticalScrollIndicator={false}
          pagingEnabled
          decelerationRate="fast"
          disableIntervalMomentum
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews={false}
          snapToInterval={pageHeight}
          snapToAlignment="start"
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.55}
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListFooterComponent={
            isLoadingMore ? (
              <View className="py-8">
                <View className="mx-auto rounded-full border border-ink-dark/8 bg-ink-dark/4 px-5 py-3">
                  <Text className="font-sans text-sm text-ink-dark/62">Loading more...</Text>
                </View>
              </View>
            ) : null
          }
        />
      )}

      <View
        className="absolute left-4 right-4 z-10"
        style={{ top: insets.top + 10 }}
        pointerEvents="box-none"
      >
        <View className="flex-row items-center justify-between" pointerEvents="box-none">
          {searchActive ? (
            <View className="flex-1 flex-row items-center rounded-full bg-ink-dark/6 px-2">
              <TouchableOpacity
                className="h-11 w-11 items-center justify-center"
                activeOpacity={0.86}
                onPress={closeSearch}
              >
                <Ionicons name="arrow-back" size={20} color={colors.inkDark} />
              </TouchableOpacity>
              <View className="mr-1">
                <Ionicons name="search" size={18} color={colors.inkDark} style={{ opacity: 0.5 }} />
              </View>
              <VelveTextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Pretrazi komade, brend..."
                className="flex-1 py-2 font-sans text-sm text-ink-dark"
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity
                  className="mr-2 h-7 w-7 items-center justify-center rounded-full bg-ink-dark/8"
                  onPress={() => setSearchQuery('')}
                >
                  <Ionicons name="close" size={14} color={colors.inkDark} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <>
              <View className="flex-1 flex-row items-center pr-3">
                <BrandWordmark width={92} tone="dark" />
                <View className="flex-1 items-center" style={{ marginRight: 32 }}>
                  <FeedModeToggle feedMode={feedMode} onChangeMode={setFeedMode} />
                </View>
              </View>
              <TouchableOpacity
                className="h-11 w-11 items-center justify-center rounded-full bg-ink-dark/6"
                activeOpacity={0.86}
                onPress={openSearch}
              >
                <Ionicons name="search" size={18} color={colors.inkDark} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <Modal
        visible={!!actionItem}
        transparent
        animationType="fade"
        onRequestClose={() => setActionItem(null)}
      >
        <Pressable className="flex-1 justify-end bg-black/55 px-4 py-4" onPress={() => setActionItem(null)}>
          <Pressable className="rounded-[34px] bg-surface-panel px-5 py-5">
            <Text className="font-display text-[28px] text-ink-dark">
              {actionItem ? `@${actionItem.userId.displayName}` : 'Opcije objave'}
            </Text>
            <Text className="mt-2 font-sans text-sm leading-6 text-ink-dark/62">
              {t('feed.sheetSubtitle')}
            </Text>

            <SheetButton
              label={t('feed.hideItem')}
              icon="eye-off-outline"
              onPress={() => actionItem && handleHideItem(actionItem)}
            />
            <SheetButton
              label={t('feed.reportItem')}
              icon="flag-outline"
              onPress={() => actionItem && handleReportItem(actionItem)}
            />
            <SheetButton
              label={t('feed.viewProfile')}
              icon="person-outline"
              onPress={() => {
                if (!actionItem) return
                router.push({ pathname: '/users/[id]', params: { id: actionItem.userId._id } })
                setActionItem(null)
              }}
            />
            <SheetButton
              label={t('feed.blockUser')}
              icon="ban-outline"
              destructive
              onPress={() => actionItem && handleBlockSeller(actionItem)}
            />

            <TouchableOpacity
              className="mt-3 items-center rounded-full bg-ink-dark/6 px-4 py-4"
              activeOpacity={0.86}
              onPress={() => setActionItem(null)}
            >
              <Text className="font-sans text-sm font-semibold text-ink-dark">
                {t('common.close')}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const FEED_TABS = [
  { key: 'following' as const, label: 'Following' },
  { key: 'for_you' as const, label: 'For You' },
]

function FeedModeToggle({
  feedMode,
  onChangeMode,
}: {
  feedMode: FeedMode
  onChangeMode: (mode: FeedMode) => void
}) {
  return (
    <View className="flex-row items-center rounded-full bg-ink-dark/6 p-1">
      {FEED_TABS.map((tab, index) => {
        const active = feedMode === tab.key
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.86}
            onPress={() => onChangeMode(tab.key)}
            className={`rounded-full px-4 py-2 ${active ? 'bg-ink-dark' : ''}`}
          >
            <Text
              className={`font-sans text-sm font-semibold ${
                active ? 'text-white' : 'text-ink-dark/45'
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const SheetButton = memo(function SheetButton({
  label,
  icon,
  destructive,
  onPress,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  destructive?: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      className="mt-3 flex-row items-center rounded-[24px] bg-surface-panel px-4 py-4"
      activeOpacity={0.86}
      onPress={onPress}
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-full ${
          destructive ? 'bg-signal-danger/10' : 'bg-brand-accent-deep/8'
        }`}
      >
        <Ionicons
          name={icon}
          size={18}
          color={destructive ? colors.danger : colors.accentDeep}
        />
      </View>
      <Text
        className="ml-3 font-sans text-sm font-semibold"
        style={{ color: destructive ? colors.danger : colors.inkDark }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
})
