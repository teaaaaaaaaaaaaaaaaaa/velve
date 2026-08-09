# Velve — Monorepo Guide za Claude Code

## Projekat
Velve je AI-powered peer-to-peer platforma za razmenu garderobe. Stack: React Native + Expo (mobile), React + Vite (web), Node.js + Express (API), Python + FastAPI (AI server), MongoDB Atlas, Cloudflare R2.

## Struktura
```
velve/
├── apps/
│   ├── api/          Node.js/Express backend
│   ├── mobile/       React Native + Expo (Expo Router, NativeWind v4)
│   ├── web/          React + Vite (Cloudflare Pages)
│   └── ai-server/    Python FastAPI (Ollama, CLIP, FAISS)
├── packages/
│   └── shared/       Zajednički TypeScript tipovi
└── docs/             PRD, dizajn smernice, planovi
```

## Kako pokrenuti

```bash
# API (Node.js)
cd apps/api && cp .env.example .env && npm install && npm run dev

# Mobile (Expo)
cd apps/mobile && cp .env.example .env && npm install && npx expo start

# Web (Vite)
cd apps/web && npm install && npm run dev

# Mobile web design preview (za Figma/Claude capture)
npm run dev:mobile:web

# AI Server (Python)
cd apps/ai-server && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements.txt && python main.py
```

## Design sistem
- Boje: brand-accent-deep (#431A43), brand-accent-light (#9DD3E4), brand-highlight (#CBDA63), base-canvas (#FFFFFF), surface-panel (#FFFFFF), ink-dark (#2B2A2B)
- base-canvas/surface-panel su namerno čisto bele (#FFFFFF) — ranija #F6F8ED/#FFFCF6 "prljavo bela" je zamenjena po eksplicitnom zahtevu; menjati samo u apps/mobile/src/design/tokens.ts i apps/mobile/tailwind.config.js zajedno
- Fontovi: Ballet (logo), Alte Haas Grotesk (headings), Inter (UI)
- Stilizacija: NativeWind v4 klase u mobile (nikad hardcoded boje/fontovi)
- Tailwind config: apps/mobile/tailwind.config.js

## Mobile design capture
- iPhone Expo Go/dev build je source of truth za mobile dizajn.
- Za mobile screen capture koristiti `npm run dev:mobile:web`, koji otvara Expo mobile app sa `EXPO_PUBLIC_DESIGN_PREVIEW=1`.
- Ne koristiti `npm run dev:web` za mobile screenove; `apps/web` je samo public landing page.
- Preview gallery je na `/design-preview` i koristi mock podatke da ekrani ne zavise od auth/backend-a.
- Svaki capture treba zabeleziti: route, platform, viewport/device, i da li se slaze sa iPhone gold screenshotom.

## Koji agent koristiti

| Zadatak | Agent |
|---|---|
| Express rute, Mongoose modeli, Firebase middleware | `backend-api` |
| Expo screens, NativeWind stilizacija, Expo Router | `mobile-ui` |
| CLIP pipeline, FAISS, Ollama, feed ranking | `ai-ml` |
| Security audit, validacija, performance | `qa-security` |

## Production server arhitektura

| Domen | Servis | Port |
|---|---|---|
| `api.velveapp.com` | Node.js API (apps/api) | 3000 |
| `ai.velveapp.com` | Python AI Server (apps/ai-server) | 8000 |

- Oba servera su na istom Ubuntu 22.04 hostu, iza Cloudflare Tunnel (velve-api)
- AI_SERVER_URL u apps/api uvek ostaje `http://localhost:8000` (interni poziv)
- NIKAD ne stavljati `ai.velveapp.com` u API .env — AI server nije javni API za mobile

## Git pull na serveru — uputstvo

**Svaki put kada pushuješ promene na `dev` branch, uradi sledeće na serveru:**

```bash
# 1. SSH na server i idi u repo
cd ~/velve          # ili gde god je kloniran repo

# 2. Pull latest
git pull origin dev

# 3a. Ako su se promenili fajlovi u apps/api → restart velve-api
pm2 restart velve-api

# 3b. Ako su se promenili fajlovi u apps/ai-server → restart velve-ai
pm2 restart velve-ai

# 4. Proveri da su oba online
pm2 status
```

> **Napomena:** `.env` fajlovi se NE commituju i NE menjaju se pull-om.
> Ako si dodao novu env varijablu, ručno je dodaj na serveru u odgovarajući `.env`.

## Važna pravila
- NIKAD ne commitovati `.env` fajlove (samo `.env.example`)
- Koristiti semantic NativeWind klase (`bg-base-canvas`, `text-ink-dark`) — ne hardcoded hex vrednosti u JSX
- Primary login: Google Sign-In. Email/password je secondary
- SMS OTP je uklonjen — ne vraćati ga
- Slike idu na Cloudflare R2 — ne u MongoDB
- MongoDB čuva samo URL-ove slika i CLIP embedding vektore
