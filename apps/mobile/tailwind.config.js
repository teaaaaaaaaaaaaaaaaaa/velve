/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Velve Brand Colors — iz design_and_identity_guidelines.md
        'brand-accent-deep': '#431A43',   // Deep Velvet — anchor, luxury
        'brand-accent-light': '#9DD3E4',  // Air Blue — freshness, glass effects
        'brand-highlight': '#CBDA63',     // Acid Lime — CTAs, highlights
        'base-canvas': '#F6F8ED',         // Base White — main background
        'ink-dark': '#2B2A2B',            // True Onyx — text, borders
      },
      fontFamily: {
        // Nikad ne koristiti hardcoded fontove u komponentama
        logo: ['Ballet'],                 // SAMO za logo i hero catchphrase
        display: ['AlteHaasGrotesk-Bold'], // Headings, aesthetic accents
        sans: ['Inter'],                  // Sve funkcionalno UI
      },
    },
  },
  plugins: [],
}
