# Velve Guest Preview + Admin Panel PRD

Datum: 19. maj 2026.

## 1. Cilj

Velve treba da pusti novog korisnika u aplikaciju odmah, bez profila, ali samo u kontrolisani preview. Gost vidi rucno izabran curated feed i dobija osecaj ukusa aplikacije pre sign-upa. Svaka namera koja trazi identitet, poverenje ili personalizaciju vodi na login.

Admin panel postaje interni operativni alat za curated guest feed, moderaciju, korisnike, iteme, analytics i produkcione health akcije.

## 2. Guest Preview

### Dozvoljeno bez naloga

- Otvaranje aplikacije direktno na feed.
- Skrolovanje curated feeda.
- Vidljiv bottom navigation, feed header i search dugme.
- Vidljivih najvise 20 itema iz admin curated liste.

### Nije dozvoljeno bez naloga

- Otvaranje item detalja.
- Like.
- Wishlist/save.
- Trade/buy proposal.
- Search.
- Profile/user screen.
- Upload, chat, wishlist, profile, closet, settings, notifications.
- Hide/report/block.

Svaki takav tap vodi na sign-in stranicu sa back dugmetom.

### Signup card posle 20 itema

Kartica se ponasa kao deo feeda, ne kao popup.

Primarni copy:

**Ovo je samo jedan deo.**  
Napravi profil da Velve pocne da prikazuje komade konkretnije po tvom ukusu, sacuva favorite i pomogne ti da pronadjes stvar koju stvarno zelis.

CTA: **Nastavi sa Google nalogom**  
Secondary: **Vrati se na feed**

## 3. Admin Panel Scope

Admin panel se radi kao zasebna Vite React aplikacija u monorepu, pod `apps/admin`. Postojeci public web landing vise nije deo ovog repo-a.

### MVP za ovu funkcionalnost

- Firebase/Google login za admin naloge.
- Server-side admin role check na svakoj admin ruti.
- Curated guest feed manager:
  - search itema po title/brand/category/owner
  - checkbox add/remove
  - reorder curated liste
  - publish/update liste
  - prikaz broken itema ako su sold/archived/deleted
- Guest analytics:
  - preview item impressions
  - attempted item open
  - attempted like/save/trade/search/nav
  - signup wall views
  - signup CTA clicks
- Audit log za svaku admin mutaciju.

### Production-ready admin panel na kraju treba da ima

- Overview dashboard: active users, active listings, open reports, guest conversion, API/AI health.
- Guest feed operations: curation, reorder, preview, publish history.
- Reports queue: item/user reports, severity, status, moderator note, action trail.
- Users: search, profile snapshot, account status, suspend/activate, role visibility.
- Items: search, owner, status, hide/archive, moderation history, image checks.
- Trades: reported/problematic trades, participants, item context, status.
- Trust & safety: blocked/report trends, abuse signals, repeated offenders.
- Analytics: guest funnel, signup conversion, content performance, search attempts.
- System tools: update engagement scores, retry embeddings, AI index health.
- Audit log: actor, action, target, timestamp, reason, metadata.

## 4. Security Requirements

- Admin panel deploy target: `admin.velveapp.com`.
- Cloudflare Access is recommended in front of the admin app.
- Admin Firebase accounts must use MFA/passkey/FIDO2 where possible.
- Backend authorization is source of truth; UI hiding is not security.
- Admin routes use deny-by-default authorization.
- Every admin mutation requires audit logging.
- Sensitive actions require a reason.
- CORS allows admin origin explicitly.
- Admin endpoints have strict rate limits.
- No secrets or `.env` files committed.
- Guest analytics stores no PII and truncates free-form metadata.

## 5. Analytics Events

Public guest endpoint accepts only allowlisted event types:

- `guest_feed_view`
- `guest_item_impression`
- `guest_item_open_attempt`
- `guest_like_attempt`
- `guest_wishlist_attempt`
- `guest_trade_attempt`
- `guest_search_attempt`
- `guest_nav_attempt`
- `guest_signup_wall_view`
- `guest_signup_cta_click`

Required fields:

- `eventType`
- `sessionId`
- optional `itemId`
- optional `metadata`
- optional `platform`
- optional `route`

## 6. Rollout Phases

1. Backend: models, public guest feed, analytics intake, admin APIs.
2. Mobile: signed-out feed access, interaction gating, signup card.
3. Admin app: login, feed curation, analytics, moderation shell.
4. Verification: lint/build, admin auth smoke tests, guest flow QA.
5. Production hardening: Cloudflare Access, MFA policy, monitoring, alerting.

## 7. Acceptance Criteria

- Signed-out user lands on feed, not login.
- Signed-out user sees only admin-curated items.
- Signed-out user cannot open item detail.
- Signed-out user cannot search, like, save, trade, navigate to protected tabs, or open profiles.
- After 20 visible items, feed shows signup card.
- Admin can search itema, select/reorder guest feed, and save.
- Admin can see guest funnel analytics.
- Non-admin receives `403` on all admin routes.
- Admin mutations create audit logs.
