Visual Identity Guide: Velve
1. Brand Concept & Aesthetic
Core Identity: Velve is a mobile-first peer-to-peer clothing exchange platform.

Aesthetic Style: "Experimental Modernism" / "Neo-Y2K".

Key Vibes: Alternative, high-fashion, fluid, glassmorphism, and bold typography.

The Goal: A clean interface that avoids "corporate minimalism" by using eccentric colors, gradients, and a mix of elegant and brutalist fonts.

2. Color Palette (Hex Codes)
Primary Brand Colors:

Deep Velvet: #431A43 (The anchor color, used for high contrast and luxury feel).

Air Blue: #9DD3E4 (Used for freshness, glass effects, and UI accents).

Acid Lime: #CBDA63 (The "alt" pop color for CTAs, highlights, and energy).

Functional Colors:

Base White: #F6F8ED (Main background, off-white for a premium feel).

True Onyx: #2B2A2B (For body text and sharp borders).

Gradient Strategy: Soft, grainy gradients blending 9DD3E4, CBDA63, and F6F8ED. Use gradients for background blurs or interactive card states.

3. Typography Hierarchy
Logo & Hero Catchphrases: Ballet (Google Font).

Usage: Only for the logo and very rare, stylized emotional statements. Never for functional text.

Headings & Aesthetic Accents: Alte Haas Grotesk (Bold/Regular).

Usage: Product titles, section headers, and "all caps" stylistic labels. This font provides the "modern-retro" look.

Interface & Utility Text: Inter (Extra Light / Regular).

Usage: Buttons, product descriptions, settings, and navigation. Must be used for maximum readability.

4. UI/UX Elements & Interaction
Glassmorphism: Use "iPhone-style" frosted glass effects for the bottom navigation bar and floating action buttons.

Properties: High blur, thin light borders (#F6F8ED at 20% opacity), and subtle drop shadows.

Layout Philosophy:

Non-basic grid: Borrow functionality from Pinterest (masonry grid) and Depop (feed style), but use asymmetrical elements or rounded corners with large radii.

Buttons: Not just rectangles. Use pill shapes or soft "squircle" shapes with subtle gradients.

Animations: Transitions should feel fluid and "organic"—think sliding cards and soft fades rather than snappy, rigid movements.

5. Component Rules for AI
Backgrounds: Never use pure #FFFFFF. Always use #F6F8ED or a very subtle gradient of the three main colors to create depth.

Contrast: Pair Deep Velvet with Acid Lime for high-impact areas (e.g., "Trade Now" buttons).

Imagery: Product photos should be the hero. UI elements should frame the clothes like a digital fashion magazine, not just a store.

6. Tailwind CSS Implementation Strategy
To ensure the design is fully scalable and maintainable, no colors or fonts should be hardcoded in the components. Everything must be referenced through the tailwind.config.js file using semantic naming. If we decide to pivot the brand colors or fonts later, we should only need to update this single configuration file.

Proposed Tailwind Configuration Mapping:
Colors (Semantic Names):

brand-accent-deep: #431A43 (Current: Deep Velvet)

brand-accent-light: #9DD3E4 (Current: Air Blue)

brand-highlight: #CBDA63 (Current: Acid Lime)

base-canvas: #F6F8ED (Current: Base White)

ink-dark: #2B2A2B (Current: True Onyx)

Typography (Semantic Names):

font-logo: Ballet (Used for identity and hero catchphrases)

font-display: Alte Haas Grotesk (Used for headings and aesthetic labels)

font-sans: Inter (The default system font for all functional UI elements)

Instruction for AI: When generating code, always use these utility classes (e.g., text-brand-accent-deep, bg-surface-primary, font-display). This allows us to swap the entire visual identity by simply modifying the Tailwind theme object without touching the JSX/HTML structure.