/** CPHIA palette from the mobile wireframe ("CPHIA 2026 Mobile App"). The app is always light, as in the wireframe. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand colours come from the event's theme (API) through CSS variables; see src/store/brandStore.js.
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--c-tertiary) / <alpha-value>)',
        cream: 'rgb(var(--c-surface) / <alpha-value>)',
        teal: { DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)', dark: 'rgb(var(--c-tertiary) / <alpha-value>)', deep: 'rgb(var(--c-tertiary) / <alpha-value>)' },
        mint: { DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)', soft: '#E3F1EC', bg: 'rgb(var(--c-surface) / <alpha-value>)' },
        sun: 'rgb(var(--c-secondary) / <alpha-value>)',
        maroon: 'rgb(var(--c-destructive) / <alpha-value>)',
        gold: '#BDA052',
        muted: '#3F5650',
        line: '#D5E5E0',
        pale: '#BFD8D5',
      },
      fontFamily: {
        sans: ['var(--app-font)', 'Roboto', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
}
