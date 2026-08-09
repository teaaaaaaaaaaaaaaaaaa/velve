import type { Ionicons } from '@expo/vector-icons';
import type { Condition, ListingType, User } from '@velve/shared';

// Local view-model types for the item detail screen (app/items/[id].tsx).
// Owner is a partial pick from the shared User DTO, same reasoning as
// ImmersiveFeedCard's FeedOwner — the API doesn't guarantee every field is
// populated on every response shape that embeds an owner.
export type Owner = Pick<User, '_id' | 'displayName'> &
  Partial<Pick<User, 'photoURL' | 'averageRating' | 'completedTrades' | 'location'>>;

export type ItemDetail = {
  _id: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  size: string;
  condition: Condition;
  images: string[];
  imageClean?: string | null;
  primaryImage?: string | null;
  isDigitized?: boolean;
  userId: Owner | string;
  createdAt: string;
  likesCount?: number;
  wishlistCount?: number;
  tradeRequestsCount?: number;
  isLiked?: boolean;
  isWishlisted?: boolean;
  listingType?: ListingType;
  price?: number;
  tradeFor?: string;
  status?: string;
};

export type UserItem = {
  _id: string;
  title: string;
  images: string[];
  imageClean?: string | null;
  primaryImage?: string | null;
  brand: string;
};

export type UnavailableItem = {
  _id?: string;
  title?: string;
  status?: string;
  category?: string;
  primaryImage?: string | null;
};

export type SideAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  active?: boolean;
  visible: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

export const CONDITION_LABELS: Record<string, string> = {
  new: 'Novo',
  like_new: 'Kao novo',
  good: 'Dobro',
  fair: 'OK stanje',
};

export const LISTING_LABELS: Record<'trade' | 'sell' | 'both', string> = {
  trade: 'Razmena',
  sell: 'Prodaja',
  both: 'Oba',
};
