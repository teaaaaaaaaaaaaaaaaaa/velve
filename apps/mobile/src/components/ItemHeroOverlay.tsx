import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';

type Owner = {
  _id: string;
  displayName: string;
  photoURL?: string;
  averageRating?: number;
  completedTrades?: number;
  location?: { city?: string; region?: string };
};

type Props = {
  title: string;
  category?: string;
  brand?: string;
  size?: string;
  condition?: 'new' | 'like_new' | 'good' | 'fair';
  price?: number;
  listingType?: 'trade' | 'sell' | 'both';
  showPrice?: boolean;
  owner?: Owner | null;
  topInset: number;
  bottomOffset: number;
  reservedRightSpace?: number;
  imageCount?: number;
  activeImageIndex?: number;
  onOwnerPress?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionAccessibilityLabel?: string;
  onActionPress?: () => void;
  showOwnerArrow?: boolean;
};

const CONDITION_LABELS: Record<NonNullable<Props['condition']>, string> = {
  new: 'Novo',
  like_new: 'Kao novo',
  good: 'Dobro',
  fair: 'OK stanje',
};

function formatPriceLabel(price?: number, listingType?: Props['listingType']) {
  if (price != null) {
    return `${price.toLocaleString('sr-Latn', {
      maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
    })} EUR`;
  }

  if (listingType === 'sell') return 'Ponudi cenu';
  if (listingType === 'both') return 'Prodaja ili razmena';
  if (listingType === 'trade') return 'Za razmenu';
  return null;
}

function buildLocationLabel(owner?: Owner | null) {
  if (!owner?.location?.city) return null;
  return `${owner.location.city}${owner.location.region ? `, ${owner.location.region}` : ''}`;
}

export function ItemHeroOverlay({
  title,
  category,
  brand,
  size,
  condition,
  price,
  listingType,
  showPrice = false,
  owner,
  topInset,
  bottomOffset,
  reservedRightSpace = 96,
  imageCount = 0,
  activeImageIndex = 0,
  onOwnerPress,
  showOwnerArrow = false,
}: Props) {
  const chips = [
    condition ? CONDITION_LABELS[condition] : null,
    category?.trim() ?? null,
    brand?.trim() ?? null,
    size?.trim() ? `Vel. ${size.trim().toUpperCase()}` : null,
  ].filter(Boolean);
  const locationLabel = buildLocationLabel(owner);
  const priceLabel = showPrice ? formatPriceLabel(price, listingType) : null;

  return (
    <>
      <View
        className="absolute left-4"
        style={{ top: topInset + 78, right: reservedRightSpace }}
        pointerEvents="box-none"
      >
        {locationLabel ? (
          <View
            className="mb-3 self-start flex-row items-center rounded-full border border-brand-highlight px-3 py-1.5"
            pointerEvents="none"
          >
            <Ionicons name="location-outline" size={13} color={colors.inkDark} />
            <Text
              className="ml-1.5 font-sans text-[12px] font-semibold text-ink-dark"
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

        <TouchableOpacity
          disabled={!onOwnerPress}
          activeOpacity={onOwnerPress ? 0.86 : 1}
          onPress={onOwnerPress}
          className="mt-3 self-start flex-row items-center"
        >
          {owner?.photoURL ? (
            <RemoteImage
              uri={owner.photoURL}
              className="h-8 w-8 rounded-full border border-ink-dark/10"
              fallback={
                <View className="h-full w-full items-center justify-center rounded-full bg-brand-accent-deep/10">
                  <Text className="font-display text-xs text-brand-accent-deep">
                    {(owner.displayName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              }
            />
          ) : (
            <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-accent-deep/10">
              <Text className="font-display text-xs text-brand-accent-deep">
                {(owner?.displayName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text className="ml-2 font-sans text-[13px] font-bold text-ink-dark" numberOfLines={1}>
            @{owner?.displayName || 'velve'}
          </Text>
          {showOwnerArrow ? (
            <Ionicons
              name="chevron-forward"
              size={13}
              color={colors.mutedText}
              style={styles.ownerArrow}
            />
          ) : null}
        </TouchableOpacity>
      </View>

      <View
        className="absolute left-4 right-4 items-center"
        style={{ bottom: bottomOffset }}
        pointerEvents="none"
      >
        {imageCount > 1 ? (
          <View className="mb-3 flex-row items-center justify-center">
            {Array.from({ length: imageCount }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === activeImageIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        ) : null}

        {chips.length > 0 || priceLabel ? (
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            {chips.map((chip, index) => (
              <View
                key={`${chip}-${index}`}
                className="shrink rounded-full border border-ink-dark px-3 py-1.5"
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
            {priceLabel ? (
              <View className="flex-row items-center rounded-full bg-brand-accent-deep px-3 py-1.5">
                <Ionicons name="cash-outline" size={13} color={colors.baseCanvas} />
                <Text
                  className="ml-1 font-sans text-[12px] font-bold text-base-canvas"
                  numberOfLines={1}
                >
                  {priceLabel}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  titleText: {
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  chip: {
    maxWidth: 110,
  },
  ownerArrow: {
    marginLeft: 3,
  },
  dot: {
    borderRadius: 999,
    marginHorizontal: 3,
  },
  dotActive: {
    width: 7,
    height: 7,
    backgroundColor: colors.inkDark,
  },
  dotInactive: {
    width: 6,
    height: 6,
    backgroundColor: 'rgba(43,42,43,0.22)',
  },
});
