import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import client from '@/api/client'
import { EditorialEmptyState } from '@/components/EditorialEmptyState'
import { FeedSkeleton } from '@/components/BrandedLoader'
import { GlassSurface } from '@/components/GlassSurface'
import { colors, shadows } from '@/design/tokens'
import { useI18n } from '@/i18n'
import { RemoteImage } from '@/components/RemoteImage'

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
  isWishlisted?: boolean
  listingType?: 'trade' | 'sell' | 'both'
  price?: number
  tradeFor?: string
}

const conditionCopy = {
  sr: {
    new: 'Novo',
    like_new: 'Kao novo',
    good: 'Dobro',
    fair: 'OK stanje',
  },
  en: {
    new: 'New',
    like_new: 'Like new',
    good: 'Good',
    fair: 'Fair',
  },
  ru: {
    new: 'Новое',
    like_new: 'Как новое',
    good: 'Хорошее',
    fair: 'Нормальное',
  },
} as const

export default function FeedScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { locale, t } = useI18n()

  const [items, setItems] = useState<Item[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [isFirstTime, setIsFirstTime] = useState(true)
  const [actionItem, setActionItem] = useState<Item | null>(null)

  const pageHeight = Math.max(windowHeight, 1)

  const fetchFeed = useCallback(
    async (pageNum: number, mode: 'replace' | 'append' = 'replace') => {
      try {
        if (pageNum === 0 && mode === 'replace') setIsLoading(true)
        else setIsLoadingMore(true)

        const params: Record<string, string | number> = { limit: 10, page: pageNum }

        if (pageNum === 0 && isFirstTime) {
          params.firstTime = 'true'
        }

        const response = await client.get('/api/feed', { params })

        if (response.data.ok) {
          const nextItems = response.data.data as Item[]
          setItems((prev) => (mode === 'append' ? [...prev, ...nextItems] : nextItems))
          setHasMore(response.data.hasMore)
          setPage(response.data.page)

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
    [isFirstTime]
  )

  useEffect(() => {
    fetchFeed(0)
  }, [fetchFeed])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchFeed(0)
  }, [fetchFeed])

  const updateItem = useCallback((itemId: string, updater: (item: Item) => Item) => {
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
      updateItem(itemId, (item) => ({ ...item, isWishlisted: !isWishlisted }))

      try {
        if (isWishlisted) {
          await client.delete(`/api/wishlist/${itemId}`)
        } else {
          await client.post(`/api/wishlist/${itemId}`)
        }
      } catch {
        updateItem(itemId, (item) => ({ ...item, isWishlisted }))
      }
    },
    [updateItem]
  )

  const handleHideItem = useCallback(async (item: Item) => {
    try {
      await client.post(`/api/items/${item._id}/hide`, { reason: 'not_interested' })
      setItems((prev) => prev.filter((entry) => entry._id !== item._id))
      setActionItem(null)
    } catch {
      Alert.alert('Greška', 'Nije moguće sakriti ovu objavu.')
    }
  }, [])

  const handleReportItem = useCallback(async (item: Item) => {
    try {
      await client.post(`/api/items/${item._id}/report`, { reason: 'community_report' })
      setActionItem(null)
      Alert.alert('Hvala', 'Prijava je poslata i pregledaćemo objavu.')
    } catch {
      Alert.alert('Greška', 'Nije moguće poslati prijavu trenutno.')
    }
  }, [])

  const handleBlockSeller = useCallback(async (item: Item) => {
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

  if (isLoading) {
    return <FeedSkeleton />
  }

  return (
    <View className="flex-1 bg-brand-accent-deep">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {items.length === 0 ? (
        <View className="flex-1 justify-center bg-base-canvas px-4 pt-20">
          <EditorialEmptyState
            icon="sparkles-outline"
            title={t('feed.emptyTitle')}
            description={t('feed.emptyDescription')}
            actionLabel={t('common.refresh')}
            onAction={() => fetchFeed(0)}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <FeedItem
              item={item}
              height={pageHeight}
              locale={locale}
              topInset={insets.top}
              bottomInset={insets.bottom}
              onOpen={() => router.push(`/items/${item._id}`)}
              onLike={() => handleLike(item._id, !!item.isLiked)}
              onWishlist={() => handleWishlist(item._id, !!item.isWishlisted)}
              onSellerPress={() =>
                router.push({ pathname: '/users/[id]', params: { id: item.userId._id } })
              }
              onMore={() => setActionItem(item)}
            />
          )}
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={pageHeight}
          snapToAlignment="start"
          disableIntervalMomentum
          onEndReached={() => {
            if (!isLoadingMore && hasMore) {
              fetchFeed(page + 1, 'append')
            }
          }}
          onEndReachedThreshold={0.7}
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListFooterComponent={
            isLoadingMore ? (
              <View className="py-8">
                <GlassSurface className="mx-auto rounded-pill px-5 py-3" dark>
                  <Text className="font-sans text-sm text-base-canvas/82">Loading more...</Text>
                </GlassSurface>
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
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-4">
          <Text className="font-sans text-[11px] uppercase tracking-[1.6px] text-base-canvas/70">
              {t('feed.discovery')}
            </Text>
            <Text className="mt-1 max-w-[250px] font-display text-[30px] leading-[30px] text-base-canvas">
              {t('feed.title')}
            </Text>
          </View>

          <TouchableOpacity
            className="rounded-pill border border-base-canvas/22 bg-brand-accent-deep/62 px-4 py-3"
            activeOpacity={0.86}
            style={shadows.glass}
            onPress={() => router.push('/search')}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="search" size={16} color={colors.baseCanvas} />
              <Text className="font-sans text-sm font-semibold text-base-canvas">
                {t('common.search')}
              </Text>
            </View>
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
          <Pressable className="rounded-editorial bg-surface-panel px-5 py-5">
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
              className="mt-3 items-center rounded-pill bg-ink-dark/6 px-4 py-4"
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

type FeedItemProps = {
  item: Item
  height: number
  locale: 'sr' | 'en' | 'ru'
  topInset: number
  bottomInset: number
  onOpen: () => void
  onLike: () => void
  onWishlist: () => void
  onSellerPress: () => void
  onMore: () => void
}

function FeedItem({
  item,
  height,
  locale,
  topInset,
  bottomInset,
  onOpen,
  onLike,
  onWishlist,
  onSellerPress,
  onMore,
}: FeedItemProps) {
  const router = useRouter()
  const { t, formatDate } = useI18n()

  const imageUri = item.images?.[0]
  const contentBottomOffset = Math.max(bottomInset, 10) + 64

  const metaParts = [
    item.brand,
    item.size ? item.size.toUpperCase() : null,
    conditionCopy[locale][item.condition],
  ].filter(Boolean)

  const metaLine = useMemo(
    () => metaParts.join(' / '),
    [metaParts]
  )

  const showPrice =
    (item.listingType === 'sell' || item.listingType === 'both') && item.price != null
  const showTradeBtn =
    !item.listingType || item.listingType === 'trade' || item.listingType === 'both'
  const showBuyBtn = item.listingType === 'sell' || item.listingType === 'both'

  return (
    <View style={{ height }} className="w-full bg-brand-accent-deep">
      {imageUri ? (
        <RemoteImage
          uri={imageUri}
          style={StyleSheet.absoluteFillObject}
          fallback={
            <View style={[StyleSheet.absoluteFillObject, styles.imageFallback]}>
              <Ionicons name="shirt-outline" size={48} color={colors.baseCanvas} />
            </View>
          }
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.imageFallback]}>
          <Text className="max-w-[180px] text-center font-sans text-sm leading-6 text-base-canvas/78">
            {t('feed.manualFallback')}
          </Text>
        </View>
      )}

      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onOpen} />
      <View style={styles.topShade} />
      <View style={styles.bottomShade} />

      <View className="absolute left-4 right-20" style={{ top: topInset + 96 }}>
        <View className="self-start rounded-pill bg-black/16 px-3 py-2">
          <Text className="font-sans text-[11px] uppercase tracking-[1.2px] text-base-canvas/78">
            {formatDate(item.createdAt, { day: 'numeric', month: 'short' })}
          </Text>
        </View>

        <Text className="mt-4 font-display text-[34px] leading-[33px] text-base-canvas" numberOfLines={2}>
          {item.title}
        </Text>

        <Text className="mt-3 font-sans text-sm leading-6 text-base-canvas/80" numberOfLines={2}>
          {metaLine}
        </Text>
      </View>

      <View className="absolute right-3 items-center gap-3" style={{ bottom: contentBottomOffset + 118 }}>
        <ActionButton
          icon={item.isLiked ? 'heart' : 'heart-outline'}
          iconColor={item.isLiked ? '#FF5F77' : colors.baseCanvas}
          label={(item.likesCount ?? 0) > 0 ? String(item.likesCount) : undefined}
          onPress={onLike}
        />
        <ActionButton
          icon={item.isWishlisted ? 'bookmark' : 'bookmark-outline'}
          iconColor={item.isWishlisted ? colors.highlight : colors.baseCanvas}
          onPress={onWishlist}
        />
        <ActionButton
          icon="paper-plane-outline"
          iconColor={colors.baseCanvas}
          onPress={() => router.push('/(tabs)/chat')}
        />
        <ActionButton
          icon="ellipsis-horizontal"
          iconColor={colors.baseCanvas}
          onPress={onMore}
        />
      </View>

      <GlassSurface
        dark
        className="absolute left-4 right-4 px-4 py-4"
        style={{ bottom: contentBottomOffset }}
      >
        <View className="flex-row items-center">
          <TouchableOpacity
            className="flex-1 flex-row items-center"
            activeOpacity={0.88}
            onPress={onSellerPress}
          >
            {item.userId?.photoURL ? (
              <RemoteImage
                uri={item.userId.photoURL}
                className="h-11 w-11 rounded-full"
                fallback={
                  <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-light/35">
                    <Text className="font-display text-2xl text-brand-accent-deep">
                      {(item.userId?.displayName || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                }
              />
            ) : (
              <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-accent-light/35">
                <Text className="font-display text-2xl text-brand-accent-deep">
                  {(item.userId?.displayName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View className="ml-3 flex-1 pr-3">
              <Text className="font-sans text-[11px] uppercase tracking-[1.1px] text-base-canvas/55">
                Seller
              </Text>
              <Text className="font-display text-2xl text-base-canvas" numberOfLines={1}>
                @{item.userId.displayName}
              </Text>
            </View>
          </TouchableOpacity>

          <View className="items-end gap-2">
            {showPrice ? (
              <View className="rounded-pill border border-brand-highlight/35 bg-brand-highlight/12 px-3 py-2">
                <Text className="font-sans text-xs font-semibold text-brand-highlight">
                  {item.price} EUR
                </Text>
              </View>
            ) : null}

            {showBuyBtn ? (
              <TouchableOpacity
                className="rounded-pill bg-brand-highlight px-4 py-3"
                activeOpacity={0.86}
                onPress={onOpen}
              >
                <Text className="font-sans text-sm font-semibold text-ink-dark">
                  {t('feed.details')}
                </Text>
              </TouchableOpacity>
            ) : showTradeBtn ? (
              <TouchableOpacity
                className="rounded-pill border border-base-canvas/18 bg-brand-accent-deep px-4 py-3"
                activeOpacity={0.86}
                onPress={() => router.push(`/items/${item._id}?openTrade=true`)}
              >
                <Text className="font-sans text-sm font-semibold text-base-canvas">
                  {t('feed.trade')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {!!item.description ? (
          <Text className="mt-4 font-sans text-sm leading-6 text-base-canvas/75" numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}
      </GlassSurface>
    </View>
  )
}

function ActionButton({
  icon,
  iconColor,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  label?: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      className="w-[52px] items-center rounded-soft border border-base-canvas/14 bg-brand-accent-deep/55 px-2 py-3"
      style={shadows.glass}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Ionicons name={icon} size={25} color={iconColor} />
      {label ? (
        <Text className="mt-1 font-sans text-xs font-semibold text-base-canvas">{label}</Text>
      ) : null}
    </TouchableOpacity>
  )
}

function SheetButton({
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
      className="mt-3 flex-row items-center rounded-soft bg-white px-4 py-4"
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
}

const styles = StyleSheet.create({
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentDeep,
    paddingHorizontal: 24,
  },
  topShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,2,4,0.12)',
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 360,
    backgroundColor: colors.overlayStrong,
  },
})
