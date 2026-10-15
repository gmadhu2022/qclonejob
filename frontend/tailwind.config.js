/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* The accent from the approved design: indigo, not the old deep navy.
           The TOKEN NAME stays `navy` on purpose. Every screen already says
           bg-navy / text-navy / border-navy-200, so repointing the scale
           restyles the whole product at once — no component markup changes,
           nothing to miss, and nothing to re-test for layout. Rename the token
           later if you want; that is a mechanical find-and-replace, not a
           redesign. */
        /* The whole product was written in `slate`, which is blue-tinted. Next
           to the indigo accent that tint reads as a faint purple wash over
           every page. The design uses warm-neutral greys instead.

           Rather than rewriting `slate-500` to `neutral-500` in forty files —
           a diff nobody could review and an easy place to miss a screen — the
           slate SCALE is repointed to neutral's values. Every existing class
           keeps working and renders the new grey. The steps line up exactly,
           so nothing shifts in contrast or weight. */
        slate: {
          50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4',
          400: '#a3a3a3', 500: '#737373', 600: '#525252', 700: '#404040',
          800: '#262626', 900: '#171717', 950: '#0a0a0a',
        },

        navy: {
          DEFAULT: '#4f46e5',   // indigo-600
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1',
          600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81',
        },
        brandgreen: {
          DEFAULT: '#4faa38',
          50: '#eef8ea', 100: '#d6efcd', 400: '#6ec24f',
          500: '#4faa38', 600: '#41922e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        /* Neutral-tinted, not navy-tinted. A coloured shadow reads as a glow
           against the near-white page; the design uses a plain soft drop. */
        card: '0 1px 2px rgba(23,23,23,0.04), 0 1px 3px rgba(23,23,23,0.06)',
        cardhover: '0 10px 15px -3px rgba(23,23,23,0.08), 0 4px 6px -4px rgba(23,23,23,0.06)',
      },
    },
  },
  plugins: [],
}
