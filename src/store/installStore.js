import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Install state for the app. Chrome, Edge and Android fire `beforeinstallprompt` once, early on page load,
 * so it is captured here at start-up (src/lib/installPrompt.js), not when a screen opens.
 */
export const useInstallStore = create(
  persist(
    (set) => ({
      deferredPrompt: null,
      dismissed: false,
      setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),
      dismiss: () => set({ dismissed: true }),
    }),
    { name: 'cphia-pwa-install', partialize: ({ dismissed }) => ({ dismissed }) },
  ),
)
