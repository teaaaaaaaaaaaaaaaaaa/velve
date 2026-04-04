# Velve Pre-Launch Checklist

Generated: 2026-04-04

This document maps the current codebase state against the planned implementation phases and lists what still needs to be done before launch.

Status legend:
- `DONE` = implemented and visible in product
- `PARTIAL` = implemented in code, but not production-ready or not fully surfaced in UI
- `NOT STARTED` = missing or not meaningfully implemented

## Executive Summary

Velve is no longer just a prototype shell. The codebase now has a real onboarding endpoint, a real personalized feed skeleton, item enrichment for like/save state, stronger trade backend flows, health checks, push notification plumbing, and a more complete profile/wishlist/liked-items loop.

However, the app is still not launch-ready.

The biggest remaining blockers before launch are:
- mobile TypeScript build is still red
- Google-first auth is only partially productionized
- feed personalization is still shallow
- hide/report/block flows are missing
- trade flow exists in backend, but not as a complete product UI
- moderation/admin tooling is still missing
- web is still only a landing page
- i18n is still missing
- design system is only partially enforced; many hardcoded styles remain

## What Has Improved Since The Previous Audit

- Google auth flow code now exists in `apps/mobile/src/hooks/useAuth.ts`
- `dbUser` is now loaded in auth context, reducing Firebase/Mongo identity mismatch
- onboarding backend route exists in `apps/api/src/routes/users.js`
- feed now uses `rankFeedItems()` and `enrichItems()`
- `GET /api/items` now supports `userId` filtering
- `GET /api/items/:id` now returns `isLiked`, `isWishlisted`, and `likesCount`
- upload API now returns `data.url`, and profile upload expects that contract
- push token save endpoint exists and backend push sender exists
- trade backend now supports list, accept/reject, complete, rate, and history endpoints
- API now exposes `/ping` and `/health`

## Phase 0 - Stabilizacija Osnove

### 0.1 TypeScript / build health
- `NOT STARTED` Mobile TS build is still red.
- Evidence:
  - `apps/mobile/src/config/firebase.ts`
  - `apps/mobile/src/hooks/useAuth.ts`
  - `apps/mobile/src/api/client.ts`
  - `apps/mobile/src/hooks/usePushNotifications.ts`
  - `apps/mobile/src/hooks/useSocket.ts`
  - `apps/mobile/app/_layout.tsx`
  - `apps/mobile/app/index.tsx`
  - `apps/mobile/app/(tabs)/chat/[id].tsx`
  - `apps/mobile/app/(tabs)/wishlist.tsx`
- Launch implication:
  - app is still not stable enough for safe iteration and release builds

### 0.2 Frontend/backend contract cleanup
- `PARTIAL`
- Fixed:
  - item detail enrichment now comes from backend
  - upload response contract is aligned
  - profile item query now uses Mongo `_id`
  - backend `GET /api/items` supports `userId`
- Still broken:
  - wishlist screen removes by wishlist document `_id` instead of `itemId`
  - profile "unlike" uses `POST /like` toggle instead of explicit remove intent

### 0.3 User identity consistency
- `PARTIAL`
- Good progress:
  - `dbUser` is now available in auth context
  - item ownership in detail screen now checks against `dbUser._id`
- Still remaining:
  - auth/fetch/socket typing is not cleaned up
  - Firebase vs Mongo identity logic still exists in multiple layers and is not yet cleanly abstracted

### 0.4 Quality gates
- `NOT STARTED`
- Current scripts do not provide:
  - lint
  - typecheck
  - test
  - CI-style launch gate

### 0.5 Error logging and monitoring
- `NOT STARTED`
- Current state:
  - health checks exist
  - console logging exists
- Missing:
  - mobile crash/error reporting
  - backend centralized error monitoring
  - release diagnostics

### 0.6 Admin endpoint hardening
- `NOT STARTED`
- Still open:
  - `/api/admin/update-scores`
  - `/api/admin/retry-embeddings`
- These still contain the "add auth later" problem.

### 0.7 Remove out-of-scope verification flows
- `NOT STARTED`
- SMS OTP routes still exist in `apps/api/src/routes/verification.js`
- This is still outside the PRD direction and should be removed or disabled before launch.

## Phase 1 - Activation Loop

### 1.1 Google-first auth
- `PARTIAL`
- Good:
  - Google auth flow is now coded in `apps/mobile/src/hooks/useAuth.ts`
- Not ready:
  - Firebase auth config still breaks TS
  - launch validation of real client IDs / redirect URIs is still missing
  - login screen still shows the old fallback alert text if Google flow errors

### 1.2 Email as secondary auth
- `DONE`
- Email login and registration flows exist and are already wired.

### 1.3 Onboarding UX
- `PARTIAL`
- Good:
  - branded 5-step onboarding flow exists
  - final submission persists onboarding data
- Missing before launch:
  - shorter/faster activation experience
  - clearer "why this matters" product framing
  - stronger first-session wow moment

### 1.4 Onboarding -> feed connection
- `PARTIAL`
- Good:
  - onboarding data is stored on user profile
  - feed ranking reads user preferences
- Still weak:
  - no category selection in onboarding, even though ranking considers category/style matching
  - no clear first-feed special treatment after onboarding
  - preference scoring is still simplistic

### 1.5 Profile completeness
- `NOT STARTED`
- No visible profile completeness indicator was found in mobile UI.

## Phase 2 - Core Discovery Loop

### 2.1 Personalized feed ranking v1
- `PARTIAL`
- Implemented:
  - freshness
  - engagement score
  - basic preference match
- Missing:
  - real visual similarity boost in ranking
  - behavioral signals such as view/save/hide/trade intent history
  - better weighting calibration

### 2.2 Like/save source of truth
- `PARTIAL`
- Good:
  - feed uses enriched items
  - item detail uses enriched item state
  - profile has saved and liked tabs
- Still remaining:
  - dedicated wishlist screen removal bug
  - inconsistent API semantics for "unlike" in profile

### 2.3 Hide / not interested
- `NOT STARTED`

### 2.4 Report item/profile
- `NOT STARTED`

### 2.5 Block user
- `NOT STARTED`

### 2.6 Similar items / you may like in UI
- `NOT STARTED`
- Backend `/api/items/:id/similar` exists, but no mobile screen consumes it.

### 2.7 Search and filter
- `NOT STARTED`
- No real discovery search/filter UI was found for category, brand, size, condition, or location.

### 2.8 Empty states
- `PARTIAL`
- Basic empty states exist, but they are still utility-level and not product-grade branded states.

## Phase 3 - Trade As A Product

### 3.1 Trade status model
- `PARTIAL`
- Implemented:
  - `pending`
  - `accepted`
  - `rejected`
  - completion flow
  - rating flow
- Missing from planned model:
  - `cancelled`
  - `expired`
  - clear pending/active lifecycle UX in product

### 3.2 Trade backend coverage
- `DONE` at backend level
- Exists:
  - create trade
  - list trades
  - accept/reject
  - complete
  - rate
  - history

### 3.3 Trade product UI
- `PARTIAL`
- Good:
  - item detail has trade modal and offered-item selection
  - chat receives automatic trade card message
- Missing:
  - dedicated trade inbox / active requests screen
  - completed / declined history UI
  - clearer state transitions for users

### 3.4 My closet management
- `NOT STARTED`
- Current item model only supports:
  - `available`
  - `pending_trade`
  - `traded`
- Missing:
  - drafts
  - archived
  - swapped/unavailable distinction
  - reorder
  - bulk actions

## Phase 4 - Engagement And Retention

### 4.1 Push notifications
- `PARTIAL`
- Good:
  - token registration flow exists
  - backend can send push for chat and trade actions
- Not ready:
  - mobile hook still fails TS build
  - launch behavior for production devices needs validation
  - notification coverage is still narrow

### 4.2 Trust layer
- `PARTIAL`
- Backend/user model supports:
  - `averageRating`
  - `completedTrades`
  - `emailVerified`
- But mobile profile currently surfaces only:
  - followers
  - following
  - items
- Missing:
  - joined date
  - response rate
  - visible rating / successful swaps card
  - profile completeness

### 4.3 Recommended modules / recently viewed
- `NOT STARTED`

## Phase 5 - Moderation And Operativa

### 5.1 Report flow
- `NOT STARTED`

### 5.2 Admin dashboard / moderation queue
- `NOT STARTED`

### 5.3 Audit log
- `NOT STARTED`

### 5.4 Abuse protection
- `PARTIAL`
- Good:
  - API rate limiting exists
  - upload moderation exists via Sightengine
  - upload limiter exists
- Missing:
  - report/chat/trade-specific abuse controls
  - real moderator tooling
  - proper production proxy/rate-limit hardening

### 5.5 Funnel analytics
- `NOT STARTED`

## Phase 6 - Design System And Visual Refresh

### 6.1 Design tokens
- `PARTIAL`
- Good:
  - semantic colors/fonts exist in `apps/mobile/tailwind.config.js`
- Missing:
  - full enforcement across components
  - spacing/radius/shadow/systemized primitives

### 6.2 Hardcoded styles removal
- `NOT STARTED`
- Many screens still hardcode:
  - colors
  - font families
  - inline backgrounds
  - opacity values
- Major offenders include:
  - `apps/mobile/app/(tabs)/feed.tsx`
  - `apps/mobile/app/(tabs)/profile.tsx`
  - `apps/mobile/app/(tabs)/chat/[id].tsx`
  - `apps/mobile/app/(tabs)/_layout.tsx`
  - `apps/web/src/App.tsx`

### 6.3 Feed as fashion-discovery UI
- `PARTIAL`
- Good:
  - fullscreen, image-led feed exists
- Still missing:
  - editorial composition
  - stronger image/meta hierarchy
  - stronger brand feel
  - more intentional empty/loading states

### 6.4 Onboarding visual quality
- `PARTIAL`
- Better than before, but still not yet a strong emotional, aspirational launch flow.

### 6.5 Profile visual identity
- `PARTIAL`
- Functional, but still reads more like a utility/settings profile than a style identity.

### 6.6 Glassmorphism and motion
- `PARTIAL`
- Tab bar is semi-transparent, but true glassmorphism, blur, layered depth, and motion system are still missing.

### 6.7 Branded loading / skeleton / empty states
- `NOT STARTED`

## Phase 7 - Web And Localization

### 7.1 Web product
- `NOT STARTED`
- Web is still a landing page placeholder.

### 7.2 i18n layer
- `NOT STARTED`

### 7.3 SR / EN / RU localization
- `NOT STARTED`
- Current app is still effectively Serbian-only.
- AI description flow only explicitly handles `sr` and fallback `en`.

## Must Fix Before Beta

- make mobile TypeScript build green
- remove SMS OTP flow
- secure admin endpoints
- finish Google auth production path
- fix remaining wishlist/save inconsistencies
- fix push notification typing and release behavior
- validate onboarding -> feed personalization end-to-end
- add at least basic report/hide/block capability
- add monitoring / error reporting

## Must Fix Before Public Launch

- trade lifecycle UI (active, history, completed)
- real moderation/admin tooling
- search/filter
- trust layer visible in UI
- named Cloudflare tunnel / stable production API URL
- stronger design system enforcement
- cleaner feed/profile/onboarding visual identity
- web decision: real MVP or explicit brand/waitlist-only site
- localization strategy at least for SR + EN

## Recommended Launch Gate

Do not call the app launch-ready until all of the following are true:

- `npx tsc --noEmit -p apps/mobile/tsconfig.json` passes
- auth works with real Google login on device
- onboarding reliably updates user profile and changes first feed
- like/save state is consistent across feed, detail, profile, and wishlist
- trade request can be created, accepted/rejected, completed, and viewed in UI
- push notifications work on real device builds
- report/hide/block exists in some usable form
- API admin endpoints are protected
- PM2 + stable API URL + health checks are documented and reliable

## Bottom Line

Velve has moved from "prototype with disconnected parts" to "real product foundation with several live subsystems." That is real progress.

But before launch, the work is no longer about adding flashy new features. The remaining work is about closing the gaps between:
- infrastructure and product
- backend capability and mobile UX
- design tokens and actual screen implementation
- internal demos and launch-grade reliability

That is the real pre-launch checklist.
