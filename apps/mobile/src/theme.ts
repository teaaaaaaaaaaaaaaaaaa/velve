// Fallback theme vrednosti — koristi NativeWind klase gde god je moguće.
// Ovaj fajl koristiti samo tamo gde NativeWind klase nisu dostupne
// (npr. u StyleSheet.create(), u animated stilovima, u trećim bibliotekama).

export const colors = {
  brandAccentDeep: '#431A43',   // Deep Velvet
  brandAccentLight: '#9DD3E4',  // Air Blue
  brandHighlight: '#CBDA63',    // Acid Lime
  baseCanvas: '#F6F8ED',        // Base White
  inkDark: '#2B2A2B',           // True Onyx
} as const

export const fonts = {
  logo: 'Ballet',
  display: 'AlteHaasGrotesk-Bold',
  sans: 'Inter',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
} as const

export const borderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const
