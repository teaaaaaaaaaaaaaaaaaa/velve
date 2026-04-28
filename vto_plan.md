Velve VTO — Implementation Plan
You have full access to the Velve monorepo. Work through these steps in order. Complete each step fully before moving to the next. Do not skip steps.
Context
Velve is a React Native (Expo) + Node.js + Python AI server app. VTO uses FASHN VTON 1.5 via Modal. The feature exists in code but is broken in several ways — the goal is to fix it and extend it.
Key files:
apps/mobile/app/vto/
apps/mobile/src/lib/imageRequests.ts
apps/api/src/routes/vto.js
apps/api/src/routes/users.js
apps/ai-server/main.py
apps/ai-server/modal_vto.py
apps/api/src/models/Item.js
apps/api/src/models/User.js
FASHN model accepts exactly three category values: "tops", "bottoms", "one-pieces". Nothing else.

Phase 0 — Diagnose
Step 0.1 — Read these files fully and trace the complete request flow from mobile tap to rendered image returned:

apps/mobile/app/vto/render.tsx
apps/api/src/routes/vto.js
apps/ai-server/main.py
apps/ai-server/modal_vto.py

Step 0.2 — Search the entire repo for every environment variable used by the VTO feature. List them all with where each is used.
Step 0.3 — Add logging at every step of the VTO pipeline (mobile → API → AI server → Modal) without changing any logic. Log: request received, category resolved, AI server called, Modal called, response received, any errors.
Step 0.4 — Create scripts/test-vto.js that sends a request directly to the AI server with hardcoded test image URLs, bypassing mobile and API. Run it with category "tops". Log the full response or error. Fix whatever is broken until this script returns a successful render.
Step 0.5 — Do not proceed to Phase 1 until you can confirm the pipeline works end-to-end via the test script.

Phase 1 — Fix Existing Bugs
Step 1.1 — Category mapping bug
In apps/api/src/routes/vto.js, find resolveGarmentCategory(). Fix it so every garment type maps to exactly one of "tops", "bottoms", or "one-pieces". Dresses and jumpsuits must map to "one-pieces", not "dresses". Add a fallback with a warning log for unknown categories. Search the rest of the repo for any other category mapping and apply the same fix.
Step 1.2 — Error propagation
Trace what the mobile app receives when the VTO pipeline fails. If it receives nothing useful, fix the API and AI server to return specific error messages that the mobile app can display to the user.
Step 1.3 — Timeouts
Find every HTTP call in the VTO chain and check if timeouts are set. VTO renders can take 90 seconds. Set timeouts: mobile→API 120s, API→AI server 150s, AI server→Modal 180s. Add a loading message in render.tsx that tells the user the render may take up to a minute.
Step 1.4 — Body scan final upload validation
In apps/api/src/routes/users.js, find the body scan upload endpoint. Currently the final saved image is not validated — only the preview is. Add server-side validation that runs the same analysis as the preview check before saving the URL to the database. If validation fails, return a clear error with feedback.
Step 1.5 — Re-run scripts/test-vto.js with "tops", "bottoms", and "one-pieces". All three must succeed before moving on.

Phase 2 — Try-On From a Listing
The goal: user sees an item listing and can tap "Try On" directly without going through the closet flow.
Step 2.1 — In apps/api/src/routes/vto.js, the current try-on endpoint only allows a user to try on their own items. Change it to allow trying on any digitized item. Keep auth required. Remove the userId ownership check on the item lookup. Keep the check that item is digitized and has imageClean.
Step 2.2 — Find the item listing/detail screen in the mobile app. Add a "Try On" button that is visible only when item.isDigitized === true and item.imageClean exists. Tapping it navigates to render.tsx with the itemId and a mode: 'quick' param.
Step 2.3 — In render.tsx, handle mode: 'quick'. If the user has no body scan, redirect to body scan onboarding. If they do, start the render automatically without showing item selection.

Phase 3 — Multi-Item Outfit Try-On
The goal: user picks multiple items from their digital closet (e.g. top + pants + jacket), tries them all on together, and saves the result as an outfit.
Step 3.1 — Add POST /api/vto/try-on-outfit endpoint in apps/api/src/routes/vto.js. It accepts an array of itemIds (max 4). It runs a sequential chain render:

Load all items, verify all are digitized
Sort items for render order: one-pieces first (and if present, skip tops/bottoms), then bottoms, then tops, then outerwear (jacket/coat/blazer mapped as tops)
Render loop: start with user's body scan as person image, render each item in order, use each render output as the person image for the next step
Upload each step result to R2
Return the final image URL and the item IDs used

Step 3.2 — In apps/mobile/app/vto/select.tsx, change from single-select to multi-select. Allow selecting up to 4 items. Show a visual indicator on selected items. Show count of selected items. Add category filters: all, tops, bottoms, one-pieces. The "Try On" button label should say "Try On Outfit" when more than one item is selected.
Step 3.3 — In render.tsx, handle both single item (itemId) and multiple items (itemIds array). For multi-item, call the new try-on-outfit endpoint. Show a loading message that explains this takes longer and is building the outfit step by step.
Step 3.4 — After a successful render, show a "Save Outfit" button. Tapping it saves to the existing outfit endpoint with the final image URL and all item IDs.
Step 3.5 — Find the outfit model/schema in the codebase. Add these metadata fields if not present: renderModel (string, default "fashn-vton-1.5"), isChainRender (boolean), chainSteps (number), categoriesUsed (array of strings), createdAt (date). Save these when creating an outfit.

Phase 4 — Delete Options
Step 4.1 — Add DELETE /api/users/body-scan endpoint. It removes the body scan URL from the user document. If a delete utility exists for R2, use it to also delete the file.
Step 4.2 — Add DELETE /api/vto/outfits/:id endpoint. Verify the outfit belongs to the requesting user before deleting.
Step 4.3 — Add UI for both: a delete option on the body scan screen, and a delete option (swipe or button) on saved outfits in the hub screen.

Phase 5 — Share Fix
Step 5.1 — In apps/mobile/app/vto/hub.tsx, fix the share function. Currently it shares a text URL. Change it to download the image to local cache first, then share the actual image file using expo-sharing. Fall back to URL share if sharing is unavailable. Install expo-sharing and expo-file-system if not already present.

Final Checks
Run through these manually or via test script and confirm each works without error:

User with no body scan taps "Try On" on a listing → redirected to body scan onboarding
User completes body scan → saved, can proceed to try-on
User tries on a single item from a listing → render succeeds, result shown
User selects 3 items from closet (top + pants + jacket) → chain render runs, final result shown, can save as outfit
User tries on a dress → renders as one-pieces, does not fail
User deletes body scan → removed from account
User deletes saved outfit → removed from list
AI server down → user sees "Try-on temporarily unavailable", no crash
Unknown item category → logs warning, defaults to "tops", does not crash