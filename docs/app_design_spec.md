# Velve App Design Spec

Based on:
- `docs/design_and_identity_guidelines.md`
- `logos/logo6.svg`

Updated: 2026-04-04

## Purpose

This document defines how Velve should look before launch at the product level, not just at the token level. It translates the brand guidelines into a screen-by-screen visual direction for the mobile app and the minimal web surface.

This is the reference for:
- overall brand feel
- logo usage
- screen composition
- component styling
- motion direction
- what must change before the UI feels like Velve instead of a generic marketplace

## Brand Core

Velve should feel like:
- digital fashion magazine
- alternative social discovery app
- premium but youthful
- soft, fluid, a little eccentric
- expressive, not corporate

Velve should not feel like:
- standard e-commerce grid
- plain startup dashboard
- “clean SaaS”
- flat white utility UI

## Primary Logo System

`logos/logo6.svg` should become the primary Velve wordmark.

Right now the app mostly renders the word `Velve` as text. That should change.

### Role of `logo6.svg`

- It is the hero identity asset.
- It should replace plain text wordmark usage on key brand moments.
- It should be treated as a fashion mark, not as a normal UI label.

### Where the logo must appear

- splash / initial loading screen
- login screen hero
- register screen hero
- onboarding welcome screen
- web landing hero

### Where the logo should not be overused

- feed headers
- form labels
- tab labels
- dense functional screens

### Logo usage rules

- Default logo color: `brand-accent-deep`
- Light version: `base-canvas` on dark photographic or deep velvet backgrounds
- Never stretch or distort it
- Always keep generous whitespace around it
- Do not put it inside a tight pill or button
- Prefer placing it as a floating editorial mark near the top third of the screen

### Suggested scale

- Login / register / onboarding hero: 140-180 px wide
- Splash: 180-220 px wide
- Web landing hero: 220-320 px wide

## Visual System

### Color behavior

Use the brand palette emotionally, not mechanically:

- `brand-accent-deep` is the anchor, used for identity, headers, strong contrast, glass tint, and premium CTAs
- `brand-accent-light` is the breathable color, used for glow, blur, soft surfaces, and airy contrast
- `brand-highlight` is the energy accent, used sparingly for key actions and success states
- `base-canvas` is the default base, never pure white
- `ink-dark` is the reading and framing color

### Surface system

The app should use 4 surface types:

- `Canvas`: off-white or subtle gradient background
- `Glass`: translucent frosted layer for bottom nav, modals, floating chips
- `Editorial Overlay`: dark transparent photo overlays in feed/detail
- `Soft Card`: rounded panel with depth for forms, chat cards, and profile modules

### Shape language

- Big radii, not boxy rectangles
- Pills and squircles for buttons and tags
- Rounded image containers
- Avoid sharp corporate panel geometry

### Typography

- `font-logo`: only for wordmark moments and rare emotional phrases
- `font-display`: screen titles, item titles, section headers, strong labels
- `font-sans`: everything functional

Typography should feel layered:
- logo = emotional
- display = editorial
- sans = useful

## Motion Direction

Motion should feel fluid and soft:

- fade + upward drift for screen entry
- horizontal card glide for onboarding steps
- subtle scale feedback for save/like
- soft sheet rise for trade modals
- blurred dissolve between image-led screens

Avoid:
- stiff snap transitions
- overly playful bounces
- generic marketplace micro-animations

## Global UI Rules

- No plain `#FFFFFF` full-screen backgrounds
- No raw hardcoded color/font usage in final implementation
- Product photos must remain the hero on feed and item screens
- Navigation chrome should feel lighter than content, never heavier
- Empty states must feel branded, not default
- Loading states should use skeletons or atmospheric placeholders, not only spinners

## Screen-by-Screen Design

## 1. Splash / Entry

### Purpose

Create a strong first impression in under 2 seconds.

### Layout

- Full-screen soft gradient background
- `logo6.svg` centered slightly above midpoint
- Small loading treatment below: shimmer line or tiny “curated for your style” copy

### Visual direction

- Deep velvet logo over light airy gradient
- Subtle grain texture
- Very soft floating blur shapes in corners

### Must feel like

- fashion app opening
- premium identity moment

## 2. Login Screen

### Goal

Make Google-first auth feel effortless and desirable.

### Layout

- Top area: `logo6.svg`
- Mid area: short emotional statement
- Bottom area: stacked actions

### Structure

- Wordmark/logo hero
- One-line brand promise
- Primary Google CTA
- Secondary email CTA
- Minimal register link

### Visual direction

- Spacious vertical rhythm
- Large logo, not just text
- Primary CTA in `brand-accent-deep`
- Secondary CTA as glass or outlined pill
- Decorative soft blobs or gradient aura behind logo

### Do not do

- Dense form-first layout
- generic auth card centered on blank background

## 3. Register Screen

### Goal

Same family as login, but more “join the community” than “create account”.

### Layout

- Smaller version of login hero
- Short form stacked in a soft elevated panel
- CTA remains bold and rounded

### Visual direction

- Less sterile form styling
- Inputs should look premium and soft, not dev-default
- Use editorial heading above form, not just plain label

## 4. Onboarding Welcome

### Goal

Make the user feel they are entering a style network, not filling a setup wizard.

### Layout

- Top: small progress treatment
- Center: logo + emotional headline + supporting copy
- Background: floating abstract shapes
- Bottom: bold CTA

### Visual direction

- Hero statement should feel aspirational
- Logo should be used here, not plain text only
- Copy should feel like invitation into a scene

## 5. Onboarding Style

### Goal

Turn preference selection into expressive taste-picking.

### Layout

- Editorial heading
- Grid of oversized style cards
- Sticky bottom CTA

### Card behavior

- unselected = light surface with strong outline
- selected = deep velvet surface or tinted gradient
- selected state should feel collectible and rewarding

### Visual direction

- Cards should look more like “taste tokens” than settings chips

## 6. Onboarding Brands

### Goal

Feel like curating a wardrobe world.

### Layout

- Same progress language as style step
- Suggested brands as big touchable capsules/cards
- Custom brand input as a softer editorial field
- Selected brands shown as premium chips

### Visual direction

- More breathing room
- Less utility form, more curation board

## 7. Onboarding Sizes

### Goal

Make required data feel frictionless and elegant.

### Layout

- Two strong selection blocks: clothing / shoes
- Each uses rounded segmented chips or sculpted pills
- Support panel underneath explaining why this matters

### Visual direction

- Utility-heavy screen, but still branded through spacing, surfaces, and type

## 8. Onboarding Location

### Goal

End onboarding on an optimistic, high-energy note.

### Layout

- City grid
- Positive confirmation panel once selected
- Bright final CTA in `brand-highlight`

### Visual direction

- This step should feel celebratory
- The “almost done” state should feel like a reveal, not just a confirmation

## 9. Feed

### Goal

This must feel like the core of the product: fashion discovery first, marketplace second.

### Layout

- Full-screen photo-led cards
- Minimal but sharp overlay information
- Right-side floating actions
- Very light UI chrome

### Visual direction

- Image is dominant hero
- Text overlays should feel like magazine captions
- User metadata should be smaller and quieter than item title
- Save / like / trade actions should feel like floating glass controls

### Desired hierarchy

- image
- title
- style/brand/condition meta
- user identity
- actions

### Missing design target

- stronger editorial crop
- better contrast treatment over photos
- richer motion between items

## 10. Item Detail

### Goal

Make the user feel they are inside the item’s story, not on a product page.

### Layout

- Full-screen image gallery
- floating back button
- top title/meta overlay
- bottom owner + description overlay
- floating action rail

### Visual direction

- cinematic and immersive
- slightly more intimate than feed
- trade CTA must feel premium and important

### Additional modules to add visually

- similar items rail
- trust signals for owner
- swap context card

## 11. Upload Screen

### Goal

Make listing feel like styling and publishing, not admin data entry.

### Layout

- strong image-first top section
- visible step progression
- structured but soft metadata form
- AI-generated content area feels like an editorial assistant

### Visual direction

- image slot grid should feel premium
- category/condition choices should feel tactile
- AI summary screen should feel rewarding, like “your item is coming to life”

## 12. Chat List

### Goal

Feel personal and stylish, not like a default messenger clone.

### Layout

- clean header
- roomy conversation rows
- avatar prominence
- better separation between unread / active / quiet conversations

### Visual direction

- soft cards or subtle sectional rhythm
- stronger personality in avatars and metadata

## 13. Chat Detail

### Goal

Mix intimacy of chat with the structured nature of trading.

### Layout

- top identity bar with user avatar
- message stream
- trade card modules embedded in stream
- bottom input bar as soft glass capsule

### Visual direction

- outgoing bubbles should feel rich and branded
- incoming bubbles should feel soft and premium
- trade card should look like a mini editorial trade ticket, not raw metadata

## 14. Profile

### Goal

Profile should feel like a style identity page, not a settings page.

### Layout

- large avatar block
- display name / identity line
- bio
- social and trust stats
- tabbed wardrobe modules

### Must visually include before launch

- stronger profile hero treatment
- visible trust metrics
- wardrobe section that feels curated

### Visual direction

- more like personal fashion profile
- less like account management

## 15. Wishlist / Saved

### Goal

Saved items should feel like a curated moodboard.

### Layout

- either soft editorial list or masonry-like save board
- larger image emphasis than current utilitarian row list

### Visual direction

- title and owner feel secondary to the saved visual curation
- empty state should feel aspirational

## 16. Tabs / Navigation

### Goal

Bottom navigation should feel like frosted jewelry, not default Expo tabs.

### Design

- true glassmorphism
- translucent background
- subtle blur
- thin light border
- generous radius
- floating feel above the canvas

### Tab icons

- minimal outline icons
- labels small and elegant
- active state should tint toward deep velvet, not scream

## 17. Web Landing

### Goal

If web remains only a landing page for now, it should at least feel unmistakably Velve.

### Layout

- hero with `logo6.svg`
- stronger editorial headline
- waitlist or app-download intent
- layered background depth

### Visual direction

- less “coming soon div”
- more fashion identity site

## Shared States

### Empty states

Every major screen should have a branded empty state:
- feed empty
- wishlist empty
- chat empty
- profile no items

Use:
- subtle illustration or abstract branded shape
- short emotional line
- one next-action CTA

### Loading states

- Prefer skeletons or atmospheric placeholders over spinners alone
- Feed should have image skeletons
- Profile should have module skeletons
- Chat should have bubble placeholders

### Error states

- Use calm, premium copy
- Never show raw, harsh, technical error feel unless in dev

## Pre-Launch Design Priorities

These are the design tasks that matter most before launch:

1. Replace text-only wordmark moments with `logo6.svg`
2. Redesign login, register, and onboarding hero screens around the actual brand
3. Upgrade feed to feel like fashion discovery, not generic item browsing
4. Redesign profile into a style identity page
5. Make bottom navigation truly glassmorphic
6. Remove hardcoded visual values and move styling into system tokens
7. Create branded empty/loading states
8. Introduce a small but consistent motion language
9. Bring the web landing into the same identity system

## Non-Negotiables Before Launch

- `logo6.svg` must be used in core brand moments
- feed must feel image-first and editorial
- bottom navigation must feel intentional and premium
- onboarding must feel aspirational, not just functional
- profile must feel like a person’s style space
- hardcoded visual styles should be reduced significantly

## Bottom Line

Velve already has the raw ingredients for a strong identity:
- a clear palette
- a distinct type hierarchy
- a non-corporate visual direction
- a usable logo asset

What is missing is consistency and productization.

The app should launch looking like a curated fashion network with trading features, not like a standard resale app with a pretty palette.
