import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { RemoteImage } from '@/components/RemoteImage'
import { colors, shadows } from '@/design/tokens'

type Owner = {
  _id: string
  displayName: string
  photoURL?: string
  averageRating?: number
  completedTrades?: number
  location?: { city?: string; region?: string }
}

type Props = {
  title: string
  category?: string
  brand?: string
  size?: string
  condition?: 'new' | 'like_new' | 'good' | 'fair'
  createdAt?: string
  price?: number
  listingType?: 'trade' | 'sell' | 'both'
  owner?: Owner | null
  topInset: number
  bottomOffset: number
  reservedRightSpace?: number
  onOwnerPress?: () => void
  actionIcon?: keyof typeof Ionicons.glyphMap
  actionAccessibilityLabel?: string
  onActionPress?: () => void
  showOwnerArrow?: boolean
}

const CONDITION_LABELS: Record<NonNullable<Props['condition']>, string> = {
  new: 'Novo',
  like_new: 'Kao novo',
  good: 'Dobro',
  fair: 'OK stanje',
}

function formatPublishedAge(dateValue?: string) {
  if (!dateValue) return ''

  const createdAt = new Date(dateValue).getTime()
  if (!Number.isFinite(createdAt)) return ''

  const elapsedMs = Math.max(Date.now() - createdAt, 0)
  const minutes = Math.floor(elapsedMs / (1000 * 60))
  if (minutes < 1) return 'sad'
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 30) return days === 1 ? '1 dan' : `${days} dana`

  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? '1 mesec' : `${months} mes.`

  const years = Math.floor(months / 12)
  return years === 1 ? '1 god.' : `${years} god.`
}

function formatPriceLabel(price?: number, listingType?: Props['listingType']) {
  if (price != null) {
    return `${price.toLocaleString('sr-Latn', {
      maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
    })} EUR`
  }

  if (listingType === 'sell') return 'Ponudi cenu'
  if (listingType === 'both') return 'Prodaja ili razmena'
  return 'Za razmenu'
}

function buildLocationLabel(owner?: Owner | null) {
  if (!owner?.location?.city) return null
  return `${owner.location.city}${owner.location.region ? `, ${owner.location.region}` : ''}`
}

export function ItemHeroOverlay({
  title,
  category,
  brand,
  size,
  condition,
  createdAt,
  price,
  listingType,
  owner,
  topInset,
  bottomOffset,
  reservedRightSpace = 96,
  onOwnerPress,
  actionIcon,
  actionAccessibilityLabel,
  onActionPress,
  showOwnerArrow = false,
}: Props) {
  const chips = [
    category?.trim() || null,
    brand?.trim() || null,
    size?.trim() ? `Vel. ${size.trim().toUpperCase()}` : null,
    condition ? CONDITION_LABELS[condition] : null,
  ].filter(Boolean)
  const locationLabel = buildLocationLabel(owner)
  const publishedLabel = formatPublishedAge(createdAt)
  const priceLabel = formatPriceLabel(price, listingType)

  return (
    <>
      <View
        className="absolute left-4"
        style={{ top: topInset + 66, right: reservedRightSpace }}
        pointerEvents="none"
      >
        {locationLabel ? (
          <View className="mb-3 self-start flex-row items-center rounded-full bg-brand-highlight px-3 py-1.5">
            <Ionicons name="location" size={13} color={colors.inkDark} />
            <Text
              className="ml-1.5 font-sans text-[12px] font-bold text-ink-dark"
              numberOfLines={1}
            >
              {locationLabel}
            </Text>
          </View>
        ) : null}

        <Text
          className="font-display text-[32px] leading-[32px] text-ink-dark"
          numberOfLines={2}
          style={styles.titleText}
        >
          {title}
        </Text>

        {chips.length > 0 ? (
          <View className="mt-3 flex-row gap-2" style={styles.chipsRow}>
            {chips.map((chip, index) => (
              <View
                key={`${chip}-${index}`}
                className="shrink rounded-full bg-surface-soft px-3 py-1.5"
                style={styles.chip}
              >
                <Text
                  className="font-sans text-[12px] font-semibold text-ink-dark"
                  numberOfLines={1}
                >
                  {chip}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View
        className="absolute left-3 right-3 flex-row items-center rounded-[28px] bg-surface-panel px-3 py-2.5"
        style={[{ bottom: bottomOffset }, styles.marketBar]}
      >
        <TouchableOpacity
          disabled={!onOwnerPress}
          activeOpacity={onOwnerPress ? 0.88 : 1}
          onPress={onOwnerPress}
          className="min-w-0 flex-1 flex-row items-center pr-2"
        >
          {owner?.photoURL ? (
            <RemoteImage
              uri={owner.photoURL}
              className="h-11 w-11 rounded-full"
              fallback={
                <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-deep/10">
                  <Text className="font-display text-base text-brand-accent-deep">
                    {(owner.displayName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              }
            />
          ) : (
            <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-accent-deep/10">
              <Text className="font-display text-base text-brand-accent-deep">
                {(owner?.displayName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text
            className="ml-3 min-w-0 flex-1 font-sans text-base font-bold text-ink-dark"
            numberOfLines={1}
          >
            @{owner?.displayName || 'velve'}
          </Text>
        </TouchableOpacity>

        <View className="ml-1 flex-row items-center justify-end gap-2" style={styles.marketMeta}>
          {publishedLabel ? (
            <Text className="font-sans text-[12px] font-bold text-ink-dark/58" numberOfLines={1}>
              {publishedLabel}
            </Text>
          ) : null}
          <View className="flex-row items-center rounded-full bg-brand-accent-deep px-3 py-2">
            <Ionicons name="cash-outline" size={14} color={colors.baseCanvas} />
            <Text
              className="ml-1 font-sans text-[13px] font-bold text-base-canvas"
              numberOfLines={1}
            >
              {priceLabel}
            </Text>
          </View>
        </View>

      </View>
    </>
  )
}

const styles = StyleSheet.create({
  marketBar: {
    ...shadows.soft,
  },
  titleText: {
    textShadowColor: 'rgba(246,248,237,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  chipsRow: {
    overflow: 'hidden',
  },
  chip: {
    maxWidth: 96,
  },
  marketMeta: {
    maxWidth: 178,
    minWidth: 118,
  },
})
