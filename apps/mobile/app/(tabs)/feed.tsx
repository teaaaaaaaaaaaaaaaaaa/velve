import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  LayoutChangeEvent,
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
import { FeedSkeleton } from '@/components/BrandedLoader'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { BrandWordmark } from '@/components/BrandWordmark'
import { ImmersiveFeedCard, ImmersiveFeedItem } from '@/components/ImmersiveFeedCard'
import { colors, shadows } from '@/design/tokens'
import { useI18n } from '@/i18n'
import { prefetchImageUri } from '@/lib/expoImage'
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
  const { height: windowHeight } = useWindowDimensions()
  const { locale, t } = useI18n()

  const [items, setItems] = useState<ImmersiveFeedItem[]>([])
  const [feedMode, setFeedMode] = useState<FeedMode>('for_you')
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [isFirstTime, setIsFirstTime] = useState(true)
  const [actionItem, setActionItem] = useState<ImmersiveFeedItem | null>(null)

  const pageHeight = Math.max(windowHeight, 1)

  const fetchFeed = useCallback(
    async (
      pageNum: number,
      mode: 'replace' | 'append' = 'replace',
      excludeIds: string[] = []
    ) => {
      try {
        if (pageNum === 0 && mode === 'replace') setIsLoading(true)
        else setIsLoadingMore(true)

        const params: Record<string, string | number> = {
          limit: 10,
          page: mode === 'append' ? 0 : pageNum,
          mode: feedMode,
        }

        if (feedMode === 'for_you' && pageNum === 0 && isFirstTime) {
          params.firstTime = 'true'
        }

        if (mode === 'append' && excludeIds.length > 0) {
          params.excludeIds = excludeIds.join(',')
        }

        const response = await client.get('/api/feed', { params })

        if (response.data.ok) {
          const nextItems = dedupeItemsById(response.data.data as ImmersiveFeedItem[])
          setItems((prev) =>
            mode === 'append' ? dedupeItemsById([...prev, ...nextItems]) : nextItems
          )
          setHasMore(response.data.hasMore)

          if (pageNum === 0 && isFirstTime) {
            setIsFirstTime(false)
          }
        }
      } catch {
        if (pageNum === 0) {
          setItems([])
        }
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
        setRefreshing(false)
      }
    },
    [feedMode, isFirstTime]
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

  if (isLoading) {
    return <FeedSkeleton />
  }

  return (
    <View className="flex-1 bg-brand-accent-deep">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {items.length === 0 ? (
        <View className="flex-1 justify-center bg-base-canvas px-4 pt-20">
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
          snapToInterval={pageHeight}
          snapToAlignment="start"
          disableIntervalMomentum
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews
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
                <View className="mx-auto rounded-full border border-white/18 bg-white/14 px-5 py-3" style={shadows.glass}>
                  <Text className="font-sans text-sm text-base-canvas/82">Loading more...</Text>
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
        <View className="flex-row items-center justify-between">
          <BrandWordmark width={92} tone="light" />

          <FeedModeToggle feedMode={feedMode} onChangeMode={setFeedMode} />

          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-full bg-white"
            activeOpacity={0.86}
            style={shadows.glass}
            onPress={() => router.push('/search')}
          >
            <Ionicons name="search" size={18} color={colors.inkDark} />
          </TouchableOpacity>
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
  const tabFrames = useRef<Array<{ x: number; width: number } | null>>([null, null])
  const [indicatorFrame, setIndicatorFrame] = useState<{ x: number; width: number } | null>(null)

  const activeIndex = feedMode === 'following' ? 0 : 1

  const syncIndicator = useCallback((index: number) => {
    const frame = tabFrames.current[index]
    if (frame) {
      setIndicatorFrame(frame)
    }
  }, [])

  const onTabLayout = useCallback(
    (index: number) => (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout
      tabFrames.current[index] = { x, width }

      if (index === activeIndex || !indicatorFrame) {
        syncIndicator(activeIndex)
      }
    },
    [activeIndex, indicatorFrame, syncIndicator]
  )

  useEffect(() => {
    syncIndicator(activeIndex)
  }, [activeIndex, syncIndicator])

  return (
    <View className="flex-row items-center rounded-full bg-white p-1">
      <View
        className="absolute h-[34px] rounded-full bg-brand-accent-deep"
        style={{
          left: indicatorFrame?.x ?? 0,
          width: indicatorFrame?.width ?? 0,
          opacity: indicatorFrame ? 1 : 0,
        }}
      />
      {FEED_TABS.map((tab, index) => {
        const active = feedMode === tab.key
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.86}
            onPress={() => onChangeMode(tab.key)}
            onLayout={onTabLayout(index)}
            className="rounded-full px-4 py-2"
          >
            <Text
              className={`font-sans text-sm font-semibold ${
                active ? 'text-base-canvas' : 'text-ink-dark/45'
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
