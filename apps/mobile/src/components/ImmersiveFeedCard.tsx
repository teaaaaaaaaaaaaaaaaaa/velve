import { Ionicons } from '@expo/vector-icons';
import type { Condition, ItemStatus, ListingType, User } from '@velve/shared';
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';

import { GlassCountActionButton } from '@/components/GlassCountActionButton';
import { ItemHeroOverlay } from '@/components/ItemHeroOverlay';
import { RemoteImage } from '@/components/RemoteImage';
import { colors } from '@/design/tokens';
import { normalizeImageUri } from '@/lib/images';
import { getPrimaryItemImage } from '@/lib/itemImages';

// The feed API populates only a subset of User, and doesn't guarantee every
// field is present (e.g. optimistic/guest payloads), so this stays a partial
// pick from the shared DTO rather than the full required shape.
type FeedOwner = Pick<User, '_id' | 'displayName'> &
  Partial<Pick<User, 'photoURL' | 'averageRating' | 'completedTrades' | 'location'>>;

export type ImmersiveFeedItem = {
  _id: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  size: string;
  condition: Condition;
  status?: ItemStatus;
  images: string[];
  imageClean?: string | null;
  primaryImage?: string | null;
  isDigitized?: boolean;
  userId: FeedOwner;
  createdAt: string;
  likesCount?: number;
  wishlistCount?: number;
  tradeRequestsCount?: number;
  isLiked?: boolean;
  isWishlisted?: boolean;
  listingType?: ListingType;
  price?: number;
  tradeFor?: string;
};

function buildCarouselImages(item: ImmersiveFeedItem) {
  const seen = new Set<string>();
  const list: string[] = [];

  const push = (uri?: string | null) => {
    if (!uri) return;
    const normalized = normalizeImageUri(uri);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    list.push(uri);
  };

  push(getPrimaryItemImage(item));
  for (const uri of item.images ?? []) push(uri);

  return list;
}

type Props = {
  item: ImmersiveFeedItem;
  height: number;
  locale: 'sr' | 'en' | 'ru';
  topInset: number;
  onLike: (itemId: string, isLiked: boolean) => void;
  onWishlist: (itemId: string, isWishlisted: boolean) => void;
  onMore?: (item: ImmersiveFeedItem) => void;
  onItemPress?: (item: ImmersiveFeedItem) => void;
  onOwnerPress?: (item: ImmersiveFeedItem) => void;
  onTradePress?: (item: ImmersiveFeedItem) => void;
  onSend?: (item: ImmersiveFeedItem) => void;
  sent?: boolean;
};

export const ImmersiveFeedCard = memo(function ImmersiveFeedCard({
  item,
  height,
  locale,
  topInset,
  onLike,
  onWishlist,
  onMore,
  onItemPress,
  onOwnerPress,
  onTradePress,
  onSend,
  sent = false,
}: Props) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const images = useMemo(() => buildCarouselImages(item), [item]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImageIndexRef = useRef(0);

  useEffect(() => {
    activeImageIndexRef.current = 0;
    setActiveImageIndex(0);
  }, [item._id]);

  const onCarouselViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0 || viewableItems[0].index == null) return;
      const nextIndex = viewableItems[0].index;
      if (activeImageIndexRef.current !== nextIndex) {
        activeImageIndexRef.current = nextIndex;
        setActiveImageIndex(nextIndex);
      }
    }
  );
  const carouselViewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 });

  const floatingTabBarHeight = 92;
  const contentBottomOffset = floatingTabBarHeight + 2;
  const labels =
    locale === 'sr'
      ? {
          trade: 'Posalji predlog za razmenu',
          like: 'Lajkuj objavu',
          save: 'Sacuvaj objavu',
          send: 'Posalji objavu prijatelju',
          more: 'Otvori opcije objave',
        }
      : {
          trade: 'Send trade proposal',
          like: 'Like listing',
          save: 'Save listing',
          send: 'Send listing to a friend',
          more: 'Open listing options',
        };

  const openItem = () => (onItemPress ? onItemPress(item) : router.push(`/items/${item._id}`));

  return (
    <View style={{ height }} className="w-full bg-surface-panel">
      {images.length > 0 ? (
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(uri, index) => `${item._id}-img-${index}`}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          nestedScrollEnabled
          onViewableItemsChanged={onCarouselViewableItemsChanged.current}
          viewabilityConfig={carouselViewabilityConfig.current}
          getItemLayout={(_, index) => ({
            length: windowWidth,
            offset: windowWidth * index,
            index,
          })}
          renderItem={({ item: uri }) => (
            <Pressable style={{ width: windowWidth, height }} onPress={openItem}>
              <RemoteImage
                uri={uri}
                contentFit="contain"
                style={{ width: windowWidth, height }}
                imageStyle={{ backgroundColor: colors.panel }}
                fallback={
                  <View style={[StyleSheet.absoluteFillObject, styles.imageFallback]}>
                    <Ionicons name="shirt-outline" size={48} color={colors.accentDeep} />
                  </View>
                }
              />
            </Pressable>
          )}
        />
      ) : (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={openItem}>
          <View style={[StyleSheet.absoluteFillObject, styles.imageFallback]}>
            <Ionicons name="shirt-outline" size={48} color={colors.accentDeep} />
          </View>
        </Pressable>
      )}

      <ItemHeroOverlay
        title={item.title}
        category={item.category}
        brand={item.brand}
        size={item.size}
        condition={item.condition}
        owner={item.userId}
        topInset={topInset}
        bottomOffset={contentBottomOffset}
        imageCount={images.length}
        activeImageIndex={activeImageIndex}
        onOwnerPress={() =>
          onOwnerPress
            ? onOwnerPress(item)
            : router.push({ pathname: '/users/[id]', params: { id: item.userId._id } })
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
          activeColor={colors.danger}
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
        {onSend ? (
          <GlassCountActionButton
            icon={sent ? 'paper-plane' : 'paper-plane-outline'}
            active={sent}
            activeColor={colors.accentDeep}
            onPress={() => onSend(item)}
            accessibilityLabel={labels.send}
            tone="dark"
          />
        ) : null}
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
  );
});

const styles = StyleSheet.create({
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    paddingHorizontal: 24,
  },
});
