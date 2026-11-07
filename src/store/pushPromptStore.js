import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * First-run push recommendation. Dismissing hides it on this device until
 * the user clears site data; enabling notifications also dismisses it.
 */
export const usePushPromptStore = create(
  persist(
    (set) => ({
      dismissed: false,
      dismiss: () => set({ dismissed: true }),
    }),
    { name: 'cphia-pwa-push-prompt', partialize: ({ dismissed }) => ({ dismissed }) },
  ),
)
