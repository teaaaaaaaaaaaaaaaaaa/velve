# Onboarding Flow

Editorial 5-step onboarding flow for new Velve users.

## Screens

1. **Welcome** (`welcome.tsx`) - Brand-first invitation into the Velve scene
2. **Style Preferences** (`style.tsx`) - Taste cards for preferred fashion moods
3. **Favorite Categories** (`categories.tsx`) - Discovery categories that shape the feed
4. **Favorite Brands** (`brands.tsx`) - Brand curation with custom input
5. **About You** (`about.tsx`) - Sizes and city in one polished finish step
6. **Success** (`success.tsx`) - Branded reveal before entering feed

## Flow Logic

- Triggered when `onboardingCompleted` is `false` in user profile
- Data saved locally in AsyncStorage between steps
- Finish step submits all data to `PUT /api/users/me/onboarding`
- Success screen previews discovery before redirecting to `/(tabs)/feed`

## Data Structure

```json
{
  "stylePreferences": ["casual", "street", "vintage"],
  "categories": ["Tops", "Jakne", "Torbe"],
  "favoriteBrands": ["Nike", "Adidas", "Zara"],
  "sizes": {
    "clothing": "M",
    "shoes": "42"
  },
  "location": {
    "city": "Beograd",
    "region": "Srbija"
  }
}
```

## Design

- Uses Velve design system colors from `tailwind.config.js`
- NativeWind v4 semantic classes only
- Progress bar shows a clear 5-step flow
- Back button on every editable step
- Glass surfaces, logo moments, and expressive typography stay consistent with the brand guide
- Smooth slide transitions between screens

## Navigation

Uses Expo Router file-based routing:
```
app/
  onboarding/
    _layout.tsx       → Stack navigator
    welcome.tsx       → Step 1
    style.tsx         → Step 2
    categories.tsx    → Step 3
    brands.tsx        → Step 4
    about.tsx         → Step 5
    success.tsx       → Completion reveal
```

## Features

- **Multi-select editorial cards** with expressive selected states
- **Custom brand input** with curated suggestions
- **Sizes and city capture** in one closing step
- **Branded success state** before entering discovery
- **Error handling** for API failures
- **Polished loading states** during submission
