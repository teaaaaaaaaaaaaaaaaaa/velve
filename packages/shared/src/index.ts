// Zajednički TypeScript tipovi — koriste se u apps/mobile, apps/admin, apps/web
//
// Ove interfejse drži usklađene sa stvarnim Mongoose šemama u apps/api/src/models/*.js
// i sa onim što rute realno vraćaju klijentu (a ne sa internim/AI-only poljima).

export type Condition = 'new' | 'like_new' | 'good' | 'fair';
export type ListingType = 'sell' | 'trade' | 'both';
export type ItemStatus =
  | 'draft'
  | 'available'
  | 'pending_trade'
  | 'traded'
  | 'sold'
  | 'unavailable'
  | 'archived'
  | 'swapped';
export type TradeKind = 'trade' | 'buy';
export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
export type UserRole = 'user' | 'moderator' | 'admin';
export type AccountStatus = 'active' | 'suspended';

export interface UserLocation {
  city?: string;
  region?: string;
}

/** Core user shape shared by every surface (mobile, admin, web). */
export interface User {
  _id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoURL: string;
  bio: string;
  role: UserRole;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  averageRating: number;
  completedTrades: number;
  onboardingCompleted: boolean;
  location?: UserLocation;
  createdAt: string;
  updatedAt: string;
}

/**
 * Core item shape shared by every surface. `embedding` is intentionally
 * omitted — it is a 768-dim CLIP vector used only inside apps/api + apps/ai-server
 * and should never be modeled as part of a client-facing DTO.
 */
export interface Item {
  _id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  size: string;
  condition: Condition;
  images: string[]; // Cloudflare R2 URL-ovi
  imageClean?: string | null;
  isDigitized: boolean;
  listingType: ListingType;
  price?: number;
  tradeFor?: string;
  status: ItemStatus;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TradeRequest {
  _id: string;
  senderId: string;
  receiverId: string;
  offeredItemId?: string;
  requestedItemId: string;
  type: TradeKind;
  offeredPrice?: number;
  status: TradeStatus;
  message: string;
  expiresAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface MessageTradeData {
  tradeRequestId?: string;
  offeredItemId: string;
  offeredItemTitle: string;
  offeredItemImage?: string;
  requestedItemId: string;
  requestedItemTitle: string;
  requestedItemImage?: string;
}

export interface MessageItemData {
  itemId: string;
  itemTitle?: string;
  itemImage?: string;
}

export interface Message {
  _id: string;
  chatId: string;
  senderId: string;
  text: string;
  type: 'text' | 'trade' | 'buy' | 'trade_update' | 'item';
  itemData?: MessageItemData;
  tradeData?: MessageTradeData;
  createdAt: string;
}

export interface Chat {
  _id: string;
  participants: string[];
  tradeRequestId?: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  updatedAt: string;
}
