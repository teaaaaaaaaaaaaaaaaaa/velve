import { Ionicons } from '@expo/vector-icons'
import { Text, TouchableOpacity, View } from 'react-native'

import { RemoteImage } from '@/components/RemoteImage'
import { colors } from '@/design/tokens'

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

function formatPublishedDate(dateValue?: string) {
  if (!dateValue) return ''

  return new Date(dateValue).toLocaleDateString('sr-Latn', {
    day: 'numeric',
    month: 'short',
  })
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
  const publishedLabel = formatPublishedDate(createdAt)
  const ownerSummary = owner?.averageRating
    ? `${owner.averageRating.toFixed(1)} rating / ${owner.completedTrades || 0} razmena`
    : `Novi profil / ${owner?.completedTrades || 0} razmena`
  const priceLabel =
    price != null
      ? `${price} EUR`
      : listingType === 'sell'
        ? 'Ponudi cenu'
        : listingType === 'both'
          ? 'Prodaja ili razmena'
          : 'Za razmenu'

  return (
    <>
      <View
        className="absolute left-4"
        style={{ top: topInset + 66, right: reservedRightSpace }}
        pointerEvents="none"
      >
        <Text
          className="font-display text-[34px] leading-[34px] text-base-canvas"
          numberOfLines={2}
        >
          {title}
        </Text>

        {chips.length > 0 ? (
          <View className="mt-4 flex-row flex-wrap gap-2">
            {chips.map((chip, index) => (
              <View key={`${chip}-${index}`} className="rounded-full bg-white/15 px-3 py-2">
                <Text className="font-sans text-[12px] font-semibold text-base-canvas">
                  {chip}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View
        className="absolute left-3 right-3 flex-row items-center rounded-[24px] bg-base-canvas px-3 py-3"
        style={{ bottom: bottomOffset }}
      >
        <TouchableOpacity
          disabled={!onOwnerPress}
          activeOpacity={onOwnerPress ? 0.88 : 1}
          onPress={onOwnerPress}
          className="flex-1 flex-row items-center pr-3"
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

          <View className="ml-3 flex-1">
            <View className="flex-row items-center">
              <Text
                className="flex-1 font-sans text-sm font-semibold text-ink-dark"
                numberOfLines={1}
              >
                @{owner?.displayName || 'velve'}
              </Text>
              {showOwnerArrow ? (
                <Ionicons name="arrow-forward" size={16} color={colors.inkDark} />
              ) : null}
            </View>

            <Text className="mt-0.5 font-sans text-[11px] text-ink-dark/50" numberOfLines={1}>
              {ownerSummary}
            </Text>

            {locationLabel ? (
              <View className="mt-1 flex-row items-center">
                <Ionicons name="location-outline" size={12} color={colors.mutedTextStrong} />
                <Text
                  className="ml-1 font-sans text-[11px] font-medium text-ink-dark/60"
                  numberOfLines={1}
                >
                  {locationLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        <View className="items-end">
          <Text className="font-sans text-base font-semibold text-brand-accent-deep">
            {priceLabel}
          </Text>
          {publishedLabel ? (
            <Text className="mt-1 font-sans text-[11px] text-ink-dark/52">
              Objavljeno {publishedLabel}
            </Text>
          ) : null}
        </View>

        {actionIcon && onActionPress ? (
          <TouchableOpacity
            className="ml-3 h-11 w-11 items-center justify-center rounded-full bg-brand-accent-deep"
            activeOpacity={0.86}
            accessibilityLabel={actionAccessibilityLabel}
            onPress={onActionPress}
          >
            <Ionicons name={actionIcon} size={18} color={colors.baseCanvas} />
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  )
}
