// Zajednički TypeScript tipovi — koriste se u apps/mobile i apps/web

export interface User {
  _id: string
  firebaseUid: string
  email: string
  displayName: string
  photoURL: string
  bio: string
  createdAt: string
  updatedAt: string
}

export interface Item {
  _id: string
  userId: string
  title: string
  description: string
  category: string
  brand: string
  size: string
  condition: 'new' | 'like_new' | 'good' | 'fair'
  images: string[]       // Cloudflare R2 URL-ovi
  embedding: number[]    // CLIP vektor (512 dim)
  createdAt: string
  updatedAt: string
}

export interface TradeRequest {
  _id: string
  senderId: string
  receiverId: string
  offeredItemId: string
  requestedItemId: string
  status: 'pending' | 'accepted' | 'rejected'
  message: string
  createdAt: string
}

export interface Message {
  senderId: string
  text: string
  createdAt: string
}

export interface Chat {
  _id: string
  participants: string[]
  messages: Message[]
  tradeRequestId?: string
  updatedAt: string
}
