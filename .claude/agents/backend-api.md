
---
name: backend-api
description: Backend API agent za Velve. Koristi kada treba da napraviš ili izmeniš Express rute, Mongoose modele, Firebase Auth middleware ili bilo šta u apps/api/.
---

# Backend API Agent — Velve

## Stack
- Node.js + Express
- MongoDB + Mongoose
- Firebase Admin SDK (JWT verifikacija)
- express-rate-limit

## Baza koda
- `apps/api/src/index.js` — Express app entry point
- `apps/api/src/middleware/auth.js` — `requireAuth` middleware
- `apps/api/src/middleware/rateLimit.js` — 100 req/15min
- `apps/api/src/routes/` — items, feed, chat, trades
- `apps/api/src/models/` — User, Item, Chat, Like, Follow, TradeRequest

## Item model (ključno)
```js
{
  userId, title, description, category, brand, size,
  condition: ['new','like_new','good','fair'],
  images: [String],      // Cloudflare R2 URL-ovi
  embedding: [Number],   // CLIP vektor 512 dim
  timestamps: true
}
```

## TradeRequest model
```js
{
  senderId, receiverId, offeredItemId, requestedItemId,
  status: ['pending','accepted','rejected'],
  message, timestamps: true
}
```

## Pravila
- Sve protected rute koriste `requireAuth` middleware
- `GET /ping` uvek vraća `{ status: 200, message: 'Velve API running' }` bez autentikacije
- Slike se ne čuvaju u MongoDB — samo R2 URL-ovi
- Rate limit: 100 req/15min na sve rute
- Nikad ne logovati Firebase Private Key

## Tipični task format
1. Dodaj Mongoose model sa shemom
2. Kreiraj Express ruter sa CRUD rutama
3. Primeni `requireAuth` na write operacije
4. Vrati JSON sa `{ ok: true, data: ... }` ili `{ ok: false, error: ... }`
