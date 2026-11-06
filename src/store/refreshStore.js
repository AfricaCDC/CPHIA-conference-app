import { create } from 'zustand'

/**
 * Global pull-to-refresh signal. Bumping `epoch` makes every `useRemote` refetch;
 * screens with their own loaders subscribe via `useRefreshListener`.
 */
export const useRefreshStore = create((set, get) => ({
  epoch: 0,
  refreshing: false,
  begin: () => {
    if (get().refreshing) return false
    set({ refreshing: true, epoch: get().epoch + 1 })
    return true
  },
  end: () => set({ refreshing: false }),
}))
