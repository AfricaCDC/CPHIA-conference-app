import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Until the API answers (or offline before the first visit), the app uses the website's default palette.
export const DEFAULT_THEME = {
  primary: '#5cbc95',
  secondary: '#f5e403',
  tertiary: '#1a6d54',
  surface: '#f8f5ec',
  ink: '#06241c',
  destructive: '#782c2d',
}

const hex = (value) => {
  const clean = value.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = Number.parseInt(full, 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

/** Writes the event's colours into CSS variables (as "r g b" so Tailwind can add opacity). */
export function applyTheme(theme) {
  const merged = { ...DEFAULT_THEME, ...(theme ?? {}) }
  const root = document.documentElement.style
  for (const [key, value] of Object.entries(merged)) {
    if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value ?? '')) root.setProperty(`--c-${key}`, hex(value))
  }
  // The browser's own toolbar colour (Android and iOS home-screen apps) follows the event.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', merged.primary)
}

/**
 * Which look to use: Material (Android and computers) or iOS (iPhone and iPad). "auto" picks from the device.
 * iOS styling is applied on any device when chosen in More → Appearance.
 */
export function detectStyle() {
  const ua = navigator.userAgent
  const iPadOnMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iPhone|iPad|iPod/.test(ua) || iPadOnMac ? 'ios' : 'material'
}

/** The event's theme and logo, from /events/{slug}; kept on the device so the app opens in the right colours. */
export const useBrandStore = create(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      logoUrl: null,
      styleMode: 'auto',
      setBrand: ({ theme, logoUrl }) => set({ theme: { ...DEFAULT_THEME, ...(theme ?? {}) }, logoUrl: logoUrl ?? null }),
      setStyleMode: (styleMode) => set({ styleMode }),
    }),
    { name: 'cphia-pwa-brand' },
  ),
)

/** The look in use right now: the user's choice, or what the device suggests. */
export function resolvedStyle(styleMode) {
  return styleMode === 'auto' ? detectStyle() : styleMode
}
