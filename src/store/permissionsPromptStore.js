import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Post-install / first-run permissions onboarding (camera + optional notifications).
 * Shown after appinstalled or when opening as an installed PWA until completed/dismissed.
 */
export const usePermissionsPromptStore = create(
  persist(
    (set) => ({
      dismissed: false,
      completed: false,
      /** Set true when the browser fires appinstalled (or after a successful install prompt). */
      needsSetup: false,
      dismiss: () => set({ dismissed: true, needsSetup: false }),
      complete: () => set({ completed: true, needsSetup: false, dismissed: true }),
      requestSetup: () => set({ needsSetup: true, dismissed: false }),
    }),
    {
      name: 'cphia-pwa-permissions-prompt',
      partialize: ({ dismissed, completed, needsSetup }) => ({ dismissed, completed, needsSetup }),
    },
  ),
)
