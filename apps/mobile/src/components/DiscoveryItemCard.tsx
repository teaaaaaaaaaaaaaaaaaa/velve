import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';

type Owner = {
  _id?: string;
  displayName?: string;
  photoURL?: string;
};

export type DiscoveryCardItem = {
  _id: string;
  title: string;
  images?: string[];
  brand?: string;
  size?: string;
  price?: number;
  listingType?: 'sell' | 'trade' | 'both';
  userId?: Owner | string;
};

type Props = {
  item: DiscoveryCardItem;
  onPress: () => void;
  badgeText?: string;
};

export function DiscoveryItemCard({ item, onPress, badgeText }: Props) {
  const imageUri = item.images?.[0];
  const owner = item.userId && typeof item.userId === 'object' ? item.userId.displayName : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      className="mb-4 flex-1 overflow-hidden rounded-[24px] border border-ink-dark/5 bg-surface-panel"
      style={{ shadowColor: '#2B2A2B', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}
    >
      <View className="relative aspect-[0.82] bg-brand-accent-light/15">
        {imageUri ? (
          <RemoteImage
            uri={imageUri}
            className="h-full w-full"
            fallback={
              <View className="h-full items-center justify-center bg-brand-accent-light/20">
                <Ionicons name="shirt-outline" size={30} color={colors.accentDeep} />
              </View>
            }
          />
        ) : (
          <View className="h-full items-center justify-center bg-brand-accent-light/20">
            <Ionicons name="shirt-outline" size={30} color={colors.accentDeep} />
          </View>
        )}

        {badgeText ? (
          <View className="absolute left-3 top-3 rounded-full bg-base-canvas/90 px-3 py-1">
            <Text className="font-sans text-[11px] font-semibold text-ink-dark">{badgeText}</Text>
          </View>
        ) : null}
      </View>

      <View className="gap-1 px-3 pb-4 pt-3">
        <Text className="font-display text-base text-ink-dark" numberOfLines={2}>
          {item.title}
        </Text>

        {owner ? (
          <Text className="font-sans text-xs text-ink-dark/55" numberOfLines={1}>
            @{owner}
          </Text>
        ) : null}

        <Text className="font-sans text-xs text-ink-dark/60" numberOfLines={1}>
          {[item.brand, item.size ? item.size.toUpperCase() : null].filter(Boolean).join(' / ') ||
            'Bez dodatnih detalja'}
        </Text>

        {(item.listingType === 'sell' || item.listingType === 'both') && item.price != null ? (
          <Text className="pt-1 font-sans text-sm font-semibold text-brand-accent-deep">
            {item.price} EUR
          </Text>
        ) : (
          <Text className="pt-1 font-sans text-sm font-semibold text-ink-dark/70">
            {item.listingType === 'trade' ? 'Za razmenu' : 'Pogledaj detalje'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
