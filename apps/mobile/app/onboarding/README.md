# Onboarding Flow

Beautiful, interactive 5-step onboarding flow for new Velve users.

## Screens

1. **Welcome** (`welcome.tsx`) - Introduction to Velve platform
2. **Style Preferences** (`style.tsx`) - Multi-select style categories
3. **Favorite Brands** (`brands.tsx`) - Brand selection with custom input
4. **Sizes** (`sizes.tsx`) - Clothing and shoe size selection
5. **Location** (`location.tsx`) - City selection and final submission

## Flow Logic

- Triggered when `onboardingCompleted` is `false` in user profile
- Data saved locally in AsyncStorage between steps
- Final step submits all data to `PUT /api/users/me/onboarding`
- After completion, redirects to `/(tabs)/feed`

## Data Structure

```json
{
  "stylePreferences": ["casual", "street", "vintage"],
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
- Progress bar shows 1/5, 2/5, etc.
- Back button on all screens except Welcome
- Skip button available (encourages completion)
- Smooth transitions between screens

## Navigation

Uses Expo Router file-based routing:
```
app/
  onboarding/
    _layout.tsx       → Stack navigator
    welcome.tsx       → Step 1
    style.tsx         → Step 2
    brands.tsx        → Step 3
    sizes.tsx         → Step 4
    location.tsx      → Step 5
```

## Features

- **Multi-select cards** with visual feedback
- **Custom brand input** with suggestions
- **Size pickers** for clothing and shoes
- **City grid** for location selection
- **Local state persistence** (survives app restart)
- **Error handling** for API failures
- **Loading states** during submission
