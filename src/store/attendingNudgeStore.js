import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Soft Action Center nudge for the attending share graphic.
 * Counts toward the home bell badge until the delegate opens the graphic screen.
 */
export const useAttendingNudgeStore = create(
  persist(
    (set) => ({
      dismissed: false,
      dismiss: () => set({ dismissed: true }),
      reset: () => set({ dismissed: false }),
    }),
    {
      name: 'cphia-pwa-attending-nudge',
      partialize: ({ dismissed }) => ({ dismissed }),
    },
  ),
)
