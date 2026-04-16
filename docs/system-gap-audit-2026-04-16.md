# System Gap Audit

## Critical
- `apps/api/src/index.js`: `/api/admin/update-scores` and `/api/admin/retry-embeddings` are marked "admin only" in comments, but they currently use only `requireAuth`, not real admin authorization.
- `apps/api/src/index.js` + `apps/api/src/lib/aiClient.js`: background jobs (`retryMissingEmbeddings`, FAISS rebuild, score updates) run on API startup and intervals with no distributed lock, so multi-instance deploys will duplicate work and can fight each other.

## High
- `apps/api/src/routes/items.js` + `apps/api/scripts/migrateEmbeddings.js` + `apps/api/src/lib/retryMissingEmbeddings.js`: embedding/index flows still include drafts and other non-public items, so search/index quality gets polluted before the API filters them out.
- `apps/api/src/routes/items.js`: new items get an embedding from the original uploaded photo immediately, then later may get a second embedding after digitization. This creates mixed visual semantics inside the vector system.
- `apps/mobile/app/(tabs)/feed.tsx`: the inline mobile search still calls `/api/items` lexical search, while the newer multilingual visual search lives in `/api/search/visual` and is not yet wired into the main UX.
- `apps/api/src/routes/wishlist.js` and several item mutation routes had inconsistent image payload shape until now. The system still needs response-contract tests so future route edits do not drift again.

## Medium
- `apps/mobile` + `apps/api`: there are still multiple mojibake/encoding artifacts in strings and comments (`Ð`, `Å`, `Â`, etc.), which will keep leaking into UI copy and logs until files are normalized to UTF-8 cleanly.
- `apps/mobile/src/hooks/useAuth.ts` + `apps/mobile/app/_layout.tsx`: auth/bootstrap flow does repeated profile fetches and repeated state transitions, which adds noise, duplicate API calls, and makes loading states easier to break.
- `apps/api/src/middleware/auth.js` + `apps/api/src/index.js`: request logging is very verbose for every request/auth event. Good for debugging, but too noisy for production and easy to turn into operational leakage.
- `apps/mobile/metro.config.js`: monorepo watch scope is broad (`workspaceRoot`), so non-JS folders like Python virtualenvs can still cause Metro/watch instability unless explicitly blocked.

## Product / Data Quality
- Current dataset is heavily draft-skewed and very small, so feed/search relevance is hard to judge honestly from current results. The infrastructure can work while product quality still looks wrong.
- `apps/api/src/lib/feedRanking.js`: ranking is heuristic-only and not calibrated against real engagement outcomes yet, so score weights are still hand-tuned guesses.
- `apps/web/src`: web app is still a very thin shell compared with mobile/API capabilities, so the monorepo is not yet product-parity across surfaces.

## Missing Safety Nets
- There are effectively no real automated tests covering image precedence, upload flow navigation, wishlist/profile payload shape, or visual search behavior.
- There is no small contract test layer protecting shared item payload fields like `primaryImage`, `imageClean`, `isDigitized`, `likesCount`, `wishlistCount`, and `tradeRequestsCount`.
