/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'brand-accent-deep': '#431A43',
        'brand-accent-light': '#9DD3E4',
        'brand-highlight': '#CBDA63',
        'base-canvas': '#F6F8ED',
        'ink-dark': '#2B2A2B',
        'surface-panel': '#FFFCF6',
        'surface-soft': '#EEF4E5',
        'surface-tint': '#EEE7EE',
        'signal-danger': '#C53B59',
      },
      fontFamily: {
        logo: ['Ballet'],
        display: ['AlteHaasGrotesk-Bold'],
        sans: ['Inter'],
      },
      spacing: {
        gutter: '20px',
        section: '28px',
        panel: '18px',
        float: '14px',
      },
      borderRadius: {
        pill: '999px',
        soft: '24px',
        card: '30px',
        editorial: '38px',
      },
    },
  },
  plugins: [],
}
