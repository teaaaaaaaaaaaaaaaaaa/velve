import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { colors } from '@/design/tokens'
import { RemoteImage } from '@/components/RemoteImage'
import { GlassCountActionButton } from '@/components/GlassCountActionButton'
import { ItemHeroOverlay } from '@/components/ItemHeroOverlay'
import { getPrimaryItemImage } from '@/lib/itemImages'

type FeedOwner = {
  _id: string
  displayName: string
  photoURL?: string
  averageRating?: number
  completedTrades?: number
  location?: { city?: string; region?: string }
}

export type ImmersiveFeedItem = {
  _id: string
  title: string
  description: string
  category: string
  brand: string
  size: string
  condition: 'new' | 'like_new' | 'good' | 'fair'
  status?: 'available' | 'pending_trade' | 'traded'
  images: string[]
  imageClean?: string | null
  primaryImage?: string | null
  isDigitized?: boolean
  userId: FeedOwner
  createdAt: string
  likesCount?: number
  wishlistCount?: number
  tradeRequestsCount?: number
  isLiked?: boolean
  isWishlisted?: boolean
  listingType?: 'trade' | 'sell' | 'both'
  price?: number
  tradeFor?: string
}

type Props = {
  item: ImmersiveFeedItem
  height: number
  locale: 'sr' | 'en' | 'ru'
  topInset: number
  bottomInset: number
  onLike: (itemId: string, isLiked: boolean) => void
  onWishlist: (itemId: string, isWishlisted: boolean) => void
  onMore?: (item: ImmersiveFeedItem) => void
  onItemPress?: (item: ImmersiveFeedItem) => void
  onOwnerPress?: (item: ImmersiveFeedItem) => void
  onTradePress?: (item: ImmersiveFeedItem) => void
}

export const ImmersiveFeedCard = memo(function ImmersiveFeedCard({
  item,
  height,
  locale,
  topInset,
  bottomInset,
  onLike,
  onWishlist,
  onMore,
  onItemPress,
  onOwnerPress,
  onTradePress,
}: Props) {
  const router = useRouter()
  const imageUri = getPrimaryItemImage(item)
  const floatingTabBarHeight = 92
  const contentBottomOffset = floatingTabBarHeight + 2
  const labels =
    locale === 'sr'
      ? {
          trade: 'Posalji predlog za razmenu',
          like: 'Lajkuj objavu',
          save: 'Sacuvaj objavu',
          more: 'Otvori opcije objave',
        }
      : {
          trade: 'Send trade proposal',
          like: 'Like listing',
          save: 'Save listing',
          more: 'Open listing options',
        }

  return (
    <View style={{ height }} className="w-full bg-surface-panel">
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => (onItemPress ? onItemPress(item) : router.push(`/items/${item._id}`))}
      >
        {imageUri ? (
          <RemoteImage
            uri={imageUri}
            contentFit="contain"
            style={styles.containedImage}
            imageStyle={{ backgroundColor: colors.panel }}
            fallback={
              <View style={[StyleSheet.absoluteFillObject, styles.imageFallback]}>
                <Ionicons name="shirt-outline" size={48} color={colors.accentDeep} />
              </View>
            }
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.imageFallback]}>
            <Ionicons name="shirt-outline" size={48} color={colors.accentDeep} />
          </View>
        )}
      </Pressable>

      <ItemHeroOverlay
        title={item.title}
        category={item.category}
        brand={item.brand}
        size={item.size}
        condition={item.condition}
        createdAt={item.createdAt}
        price={item.price}
        listingType={item.listingType}
        owner={item.userId}
        topInset={topInset}
        bottomOffset={contentBottomOffset}
        onOwnerPress={() =>
          onOwnerPress
            ? onOwnerPress(item)
            : router.push({ pathname: '/users/[id]', params: { id: item.userId._id } })
        }
        actionIcon="swap-horizontal"
        actionAccessibilityLabel={labels.trade}
        onActionPress={() =>
          onTradePress ? onTradePress(item) : router.push(`/items/${item._id}?openTrade=true`)
        }
        showOwnerArrow
      />

      <View
        className="absolute right-3 items-center gap-3"
        style={{ bottom: contentBottomOffset + 112 }}
      >
        <GlassCountActionButton
          icon={item.isLiked ? 'heart' : 'heart-outline'}
          count={item.likesCount ?? 0}
          active={!!item.isLiked}
          onPress={() => onLike(item._id, !!item.isLiked)}
          accessibilityLabel={labels.like}
          tone="dark"
        />
        <GlassCountActionButton
          icon="swap-horizontal"
          count={item.tradeRequestsCount ?? 0}
          onPress={() =>
            onTradePress ? onTradePress(item) : router.push(`/items/${item._id}?openTrade=true`)
          }
          accessibilityLabel={labels.trade}
          tone="dark"
        />
        <GlassCountActionButton
          icon={item.isWishlisted ? 'bookmark' : 'bookmark-outline'}
          count={item.wishlistCount ?? 0}
          active={!!item.isWishlisted}
          onPress={() => onWishlist(item._id, !!item.isWishlisted)}
          accessibilityLabel={labels.save}
          tone="dark"
        />
        {onMore ? (
          <GlassCountActionButton
            icon="ellipsis-horizontal"
            onPress={() => onMore(item)}
            accessibilityLabel={labels.more}
            tone="dark"
          />
        ) : null}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  containedImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.panel,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    paddingHorizontal: 24,
  },
})
