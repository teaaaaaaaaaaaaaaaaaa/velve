---
name: mobile-ui
description: Mobile UI agent za Velve. Koristi kada treba da napraviš ili izmeniš Expo screens, navigaciju, stilizaciju, animacije ili hooks u apps/mobile/.
---

# Mobile UI Agent — Velve

## Stack
- React Native + Expo SDK 51
- Expo Router (file-based routing)
- NativeWind v4 (Tailwind klase u React Native)
- Firebase (auth)
- Axios (API pozivi)

## Struktura
```
apps/mobile/src/
├── app/
│   ├── _layout.tsx          RootLayout — auth guard
│   ├── (auth)/login.tsx     LoginScreen
│   ├── (auth)/register.tsx  RegisterScreen
│   └── (tabs)/
│       ├── _layout.tsx      Bottom tab navigator
│       ├── feed.tsx         FeedScreen
│       ├── upload.tsx       UploadScreen
│       ├── profile.tsx      ProfileScreen
│       └── chat/index.tsx   ChatListScreen
│       └── chat/[id].tsx    ChatScreen
├── hooks/useAuth.ts         Google Sign-In, email/pass, logout
├── api/client.ts            Axios + Firebase token interceptor
└── theme.ts                 Fallback vrednosti (koristiti retko)
```

## Design sistem (OBAVEZNO)
```
NativeWind klase — uvek koristiti semantic klase:
bg-base-canvas       → #F6F8ED (pozadina)
bg-brand-accent-deep → #431A43 (primary button)
bg-brand-highlight   → #CBDA63 (CTA, akcent)
text-ink-dark        → #2B2A2B (tekst)
font-logo            → Ballet
font-display         → Alte Haas Grotesk
font-sans            → Inter

NIKAD ne koristiti hardcoded hex vrednosti u JSX!
```

## Button stilovi
- Primary: `bg-brand-accent-deep rounded-full py-4 px-6`
- Secondary: `border border-ink-dark rounded-full py-4 px-6`
- CTA/highlight: `bg-brand-highlight rounded-full py-4 px-6`

## Pravila
- Svaki screen: `flex-1 bg-base-canvas`
- Navigacija: Expo Router — ne React Navigation
- Google Sign-In je PRIMARY login (jedan klik)
- Email/password je SECONDARY (u posebnom screenu)
- Glassmorphism za tab bar: `rgba(246, 248, 237, 0.85)` + blur
- Animacije: buduće — Reanimated 3 (ne dodavati sada)

## API pozivi
- Koristiti `src/api/client.ts` — automatski dodaje Firebase token
- Nikad ne pozivati fetch direktno
