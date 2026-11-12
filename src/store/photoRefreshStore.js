import { create } from 'zustand'

/** Progress for the speaker-photo refresh that runs once when the app opens. */
export const usePhotoRefreshStore = create((set, get) => ({
  active: false,
  done: 0,
  total: 0,
  start: (total) => set({ active: true, done: 0, total }),
  tick: () => set({ done: Math.min(get().total, get().done + 1) }),
  setDone: (done) => set({ done }),
  finish: () => set({ active: false }),
}))
