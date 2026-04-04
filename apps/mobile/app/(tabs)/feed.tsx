import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import client from '@/api/client'

const SCREEN_WIDTH = Dimensions.get('window').width

const CONDITION_LABELS: Record<string, string> = {
  new: 'Novo',
  like_new: 'Kao novo',
  good: 'Dobro',
  fair: 'OK stanje',
}

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

export default function FeedScreen() {
  const [items, setItems] = useState<Item[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [containerHeight, setContainerHeight] = useState(Dimensions.get('window').height - 85)

  const fetchFeed = async (pageNum: number) => {
    try {
      if (pageNum === 0) setIsLoading(true)
      else setIsLoadingMore(true)

      const response = await client.get('/api/feed', {
        params: { limit: 10, page: pageNum },
      })

      if (response.data.ok) {
        const newItems = response.data.data
        setItems((prev) => (pageNum === 0 ? newItems : [...prev, ...newItems]))
        setHasMore(response.data.hasMore)
        setPage(response.data.page)
      }
    } catch {
      // silent fail
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchFeed(0)
  }, [])

  const handleLike = useCallback(async (itemId: string) => {
    let originalLiked = false
    let originalCount = 0
    setItems((prev) => {
      const current = prev.find((i) => i._id === itemId)
      if (current) {
        originalLiked = !!current.isLiked
        originalCount = current.likesCount ?? 0
      }
      return prev.map((item) =>
        item._id === itemId
          ? {
              ...item,
              isLiked: !item.isLiked,
              likesCount: (item.likesCount ?? 0) + (item.isLiked ? -1 : 1),
            }
          : item
      )
    })
    try {
      const response = await client.post(`/api/items/${itemId}/like`)
      if (response.data.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item._id === itemId
              ? { ...item, isLiked: response.data.isLiked, likesCount: response.data.likesCount }
              : item
          )
        )
      }
    } catch {
      setItems((prev) =>
        prev.map((item) =>
          item._id === itemId
            ? { ...item, isLiked: originalLiked, likesCount: originalCount }
            : item
        )
      )
    }
  }, [])

  const handleWishlist = useCallback(async (itemId: string, isWishlisted: boolean) => {
    try {
      if (isWishlisted) {
        await client.delete(`/api/wishlist/${itemId}`)
      } else {
        await client.post(`/api/wishlist/${itemId}`)
      }
      setItems((prev) =>
        prev.map((item) =>
          item._id === itemId ? { ...item, isWishlisted: !isWishlisted } : item
        )
      )
    } catch {}
  }, [])

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#F6F8ED" />
      </View>
    )
  }

  if (items.length === 0) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.emptyText}>Nema itema u feedu</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchFeed(0)}>
          <Text style={styles.refreshBtnText}>Osvezi</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <StatusBar barStyle="light-content" />
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <FeedItem
            item={item}
            height={containerHeight}
            onLike={() => handleLike(item._id)}
            onWishlist={() => handleWishlist(item._id, !!item.isWishlisted)}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        onEndReached={() => {
          if (!isLoadingMore && hasMore) fetchFeed(page + 1)
        }}
        onEndReachedThreshold={3}
        getItemLayout={(_, index) => ({
          length: containerHeight,
          offset: containerHeight * index,
          index,
        })}
      />
    </View>
  )
}

type FeedItemProps = {
  item: Item
  height: number
  onLike: () => void
  onWishlist: () => void
}

function FeedItem({ item, height, onLike, onWishlist }: FeedItemProps) {
  const router = useRouter()

  const metaParts = [
    item.brand,
    item.size ? item.size.toUpperCase() : null,
    CONDITION_LABELS[item.condition],
  ].filter(Boolean)

  const showPrice = (item.listingType === 'sell' || item.listingType === 'both') && item.price != null
  const showTradeBtn = !item.listingType || item.listingType === 'trade' || item.listingType === 'both'
  const showBuyBtn = item.listingType === 'sell' || item.listingType === 'both'

  return (
    <View style={[styles.item, { height }]}>
      {/* Full screen image */}
      <Image
        source={{ uri: item.images[0] || '' }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {/* Top info: title + details */}
      <View style={styles.topInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.itemMeta}>{metaParts.join('  ·  ')}</Text>
      </View>

      {/* Bottom info: user + description + price */}
      <View style={styles.bottomInfo}>
        {typeof item.userId === 'object' && (
          <View style={styles.userRow}>
            <Image
              source={{ uri: item.userId.photoURL || '' }}
              style={styles.avatar}
            />
            <Text style={styles.userName}>@{item.userId.displayName}</Text>
          </View>
        )}
        {showPrice && (
          <Text style={styles.priceText}>{item.price} EUR</Text>
        )}
        {!!item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>

      {/* Right side actions */}
      <View style={styles.sideActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike} activeOpacity={0.8}>
          <Ionicons
            name={item.isLiked ? 'heart' : 'heart-outline'}
            size={34}
            color={item.isLiked ? '#FF3B5C' : 'white'}
          />
          <Text style={styles.actionCount}>{item.likesCount ?? 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onWishlist} activeOpacity={0.8}>
          <Ionicons
            name={item.isWishlisted ? 'bookmark' : 'bookmark-outline'}
            size={32}
            color={item.isWishlisted ? '#CBDA63' : 'white'}
          />
          <Text style={styles.actionLabel}>Sačuvaj</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(tabs)/chat')}
          activeOpacity={0.8}
        >
          <Ionicons name="paper-plane-outline" size={32} color="white" />
          <Text style={styles.actionLabel}>Poruka</Text>
        </TouchableOpacity>

        {showTradeBtn && (
          <TouchableOpacity
            style={styles.tradeBtn}
            onPress={() => router.push(`/items/${item._id}?openTrade=true`)}
            activeOpacity={0.8}
          >
            <Text style={styles.tradeBtnText}>Razmeni</Text>
          </TouchableOpacity>
        )}

        {showBuyBtn && (
          <TouchableOpacity
            style={styles.buyBtn}
            onPress={() => router.push(`/items/${item._id}`)}
            activeOpacity={0.8}
          >
            <Text style={styles.buyBtnText}>Kupi</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const shadow = {
  textShadowColor: 'rgba(0,0,0,0.85)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loading: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'white',
    fontFamily: 'AlteHaasGrotesk-Bold',
    fontSize: 18,
    marginBottom: 16,
  },
  refreshBtn: {
    backgroundColor: '#431A43',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  refreshBtnText: {
    color: '#F6F8ED',
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
  },
  item: {
    width: SCREEN_WIDTH,
    backgroundColor: 'black',
    overflow: 'hidden',
  },
  topInfo: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 84,
  },
  itemTitle: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'AlteHaasGrotesk-Bold',
    marginBottom: 6,
    ...shadow,
  },
  itemMeta: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: 'Inter',
    ...shadow,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 88,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    marginRight: 8,
  },
  userName: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '700',
    ...shadow,
  },
  priceText: {
    color: '#CBDA63',
    fontSize: 15,
    fontFamily: 'Inter',
    fontWeight: '700',
    marginBottom: 4,
    ...shadow,
  },
  description: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: 'Inter',
    lineHeight: 19,
    ...shadow,
  },
  sideActions: {
    position: 'absolute',
    right: 12,
    bottom: 110,
    alignItems: 'center',
    gap: 20,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionCount: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: '700',
    marginTop: 3,
    ...shadow,
  },
  actionLabel: {
    color: 'white',
    fontSize: 11,
    fontFamily: 'Inter',
    marginTop: 3,
    ...shadow,
  },
  tradeBtn: {
    backgroundColor: '#431A43',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 4,
  },
  tradeBtnText: {
    color: '#F6F8ED',
    fontSize: 13,
    fontFamily: 'Inter',
    fontWeight: '700',
  },
  buyBtn: {
    backgroundColor: '#CBDA63',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 4,
  },
  buyBtnText: {
    color: '#2B2A2B',
    fontSize: 13,
    fontFamily: 'Inter',
    fontWeight: '700',
  },
})
