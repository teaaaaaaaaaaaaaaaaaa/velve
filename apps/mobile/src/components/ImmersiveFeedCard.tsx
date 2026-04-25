import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { memo, useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors } from '@/design/tokens'
import { RemoteImage } from '@/components/RemoteImage'
import { GlassCountActionButton } from '@/components/GlassCountActionButton'
import { getPrimaryItemImage } from '@/lib/itemImages'

type FeedOwner = {
  _id: string
  displayName: string
  photoURL?: string
  averageRating?: number
  completedTrades?: number
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

function formatFeedDate(dateValue: string) {
  return new Date(dateValue).toLocaleDateString('sr-Latn', {
    day: 'numeric',
    month: 'short',
  })
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
}: Props) {
  const router = useRouter()
  const imageUri = getPrimaryItemImage(item)
  const contentBottomOffset = Math.max(bottomInset, 10) + 28

  const metaLine = useMemo(
    () =>
      [item.brand, item.size ? item.size.toUpperCase() : null, conditionCopy[locale][item.condition]]
        .filter(Boolean)
        .join(' / '),
    [item.brand, item.condition, item.size, locale]
  )

  return (
    <View style={{ height }} className="w-full bg-white">
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={() => router.push(`/items/${item._id}`)}
      >
        {imageUri ? (
          <RemoteImage
            uri={imageUri}
            contentFit="contain"
            style={styles.containedImage}
            imageStyle={{ backgroundColor: '#FFFFFF' }}
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
      </TouchableOpacity>

      <View className="absolute left-4 right-24" style={{ top: topInset + 62 }}>
        <View className="self-start rounded-full bg-ink-dark/6 px-3 py-2">
          <Text className="font-sans text-[11px] uppercase tracking-[1.2px] text-ink-dark/60">
            {formatFeedDate(item.createdAt)}
          </Text>
        </View>

        <Text className="mt-4 font-display text-[34px] leading-[33px] text-ink-dark" numberOfLines={2}>
          {item.title}
        </Text>

        <Text className="mt-3 font-sans text-sm leading-6 text-ink-dark/62" numberOfLines={1}>
          {metaLine}
        </Text>
      </View>

      <View
        className="absolute right-3 items-center gap-3"
        style={{ bottom: contentBottomOffset + 102 }}
      >
        <GlassCountActionButton
          icon={item.isLiked ? 'heart' : 'heart-outline'}
          count={item.likesCount ?? 0}
          active={!!item.isLiked}
          onPress={() => onLike(item._id, !!item.isLiked)}
          accessibilityLabel="Lajkuj objavu"
          tone="dark"
        />
        <GlassCountActionButton
          icon="swap-horizontal"
          count={item.tradeRequestsCount ?? 0}
          onPress={() => router.push(`/items/${item._id}?openTrade=true`)}
          accessibilityLabel="Posalji predlog za razmenu"
          tone="dark"
        />
        <GlassCountActionButton
          icon={item.isWishlisted ? 'bookmark' : 'bookmark-outline'}
          count={item.wishlistCount ?? 0}
          active={!!item.isWishlisted}
          onPress={() => onWishlist(item._id, !!item.isWishlisted)}
          accessibilityLabel="Sacuvaj objavu"
          tone="dark"
        />
        {onMore ? (
          <GlassCountActionButton
            icon="ellipsis-horizontal"
            onPress={() => onMore(item)}
            accessibilityLabel="Otvori opcije objave"
            tone="dark"
          />
        ) : null}
      </View>

      <View
        className="absolute left-3 right-3 flex-row items-center rounded-[22px] bg-white px-3 py-2.5"
        style={[{ bottom: contentBottomOffset }, styles.bottomCard]}
      >
        <TouchableOpacity
          className="flex-1 flex-row items-center"
          activeOpacity={0.88}
          onPress={() => router.push({ pathname: '/users/[id]', params: { id: item.userId._id } })}
        >
          {item.userId?.photoURL ? (
            <RemoteImage
              uri={item.userId.photoURL}
              className="h-9 w-9 rounded-full"
              fallback={
                <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-deep/10">
                  <Text className="font-display text-base text-brand-accent-deep">
                    {(item.userId?.displayName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              }
            />
          ) : (
            <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-accent-deep/10">
              <Text className="font-display text-base text-brand-accent-deep">
                {(item.userId?.displayName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View className="ml-2.5 flex-1 pr-2">
            <Text className="font-sans text-sm font-semibold text-ink-dark" numberOfLines={1}>
              @{item.userId.displayName}
            </Text>
            <Text className="font-sans text-[11px] text-ink-dark/50" numberOfLines={1}>
              {item.userId.averageRating
                ? `${item.userId.averageRating.toFixed(1)} rating`
                : 'Novi profil'}{' '}
              · {item.userId.completedTrades || 0} razmena
            </Text>
          </View>
        </TouchableOpacity>

        <View className="flex-row items-center gap-2">
          {item.price != null ? (
            <Text className="font-sans text-xs font-semibold text-ink-dark">{item.price} EUR</Text>
          ) : null}

          <TouchableOpacity
            className="h-10 w-10 items-center justify-center rounded-full bg-brand-accent-deep"
            activeOpacity={0.86}
            onPress={() => router.push(`/items/${item._id}?openTrade=true`)}
          >
            <Ionicons name="swap-horizontal" size={18} color={colors.baseCanvas} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  containedImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  bottomCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
})
