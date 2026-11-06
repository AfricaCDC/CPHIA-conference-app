import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { homeScreenFor } from '../lib/roles'
import { useSessionStore } from './sessionStore'

const home = () => {
  const { capabilities, staffDesks } = useSessionStore.getState()
  return homeScreenFor(capabilities, staffDesks ?? [], useAppStore.getState().mode)
}

// Push notifications open /?screen=<name>; a few names are aliases for a tab inside a screen.
const SCREEN_ALIASES = {
  chats: ['messages', { tab: 'chats' }],
  'staff-dashboard': ['shome', {}],
  'staff-scan': ['sscan', {}],
}

function resolveScreen(screen, params = {}) {
  const alias = SCREEN_ALIASES[screen]
  return alias ? { screen: alias[0], params: { ...alias[1], ...params } } : { screen, params }
}

export const useAppStore = create(
  persist(
    (set, get) => ({
      // Navigation: a single-page stack, so "back" works without a router.
      screen: 'home',
      params: {},
      history: [],
      // Delegate and staff: which app a user who has both is in ('delegate', 'staff', or null until they choose).
      mode: null,
      setMode: (mode) => set({ mode }),
      navigateTo: (target, targetParams = {}) => {
        const { screen, params } = resolveScreen(target, targetParams)
        const { screen: current, params: currentParams, history } = get()
        if (screen === current && JSON.stringify(params) === JSON.stringify(currentParams)) return
        set({ screen, params, history: [...history, { screen: current, params: currentParams }] })
        window.scrollTo(0, 0)
      },
      goBack: () => {
        const { history } = get()
        const previous = history.at(-1) ?? { screen: home(), params: {} }
        set({ ...previous, history: history.slice(0, -1) })
      },
      switchTab: (screen) => {
        set({ screen, params: {}, history: [] })
        window.scrollTo(0, 0)
      },
      goHome: () => set({ screen: home(), params: {}, history: [] }),

      // My schedule (programme session ids), kept on this device like the native app.
      schedule: [],
      toggleSession: (id) => {
        const schedule = get().schedule
        set({ schedule: schedule.includes(id) ? schedule.filter((s) => s !== id) : [...schedule, id] })
      },

      // Quick tour: opens on first use of the app. "Skip" hides it until the app is opened
      // again; finishing it or ticking "Don't show again" hides it for good (per user, on this device).
      toursSeen: [],
      markTourSeen: (userId) => set({ toursSeen: [...new Set([...get().toursSeen, userId])] }),
      tourOpen: false,
      tourSkipped: false,
      setTourOpen: (tourOpen) => set({ tourOpen }),
      skipTour: () => set({ tourOpen: false, tourSkipped: true }),

      // UI
      toast: null,
      showToast: (message, tone = 'success') => set({ toast: { message, tone, id: Date.now() } }),
      clearToast: () => set({ toast: null }),

      // A notice stays on screen until dismissed, so a failure is still visible after the app returns home.
      notice: null,
      showNotice: (message) => set({ notice: { message, id: Date.now() } }),
      clearNotice: () => set({ notice: null }),
    }),
    {
      name: 'cphia-pwa',
      partialize: ({ schedule, toursSeen, mode }) => ({ schedule, toursSeen, mode }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const requested = new URLSearchParams(window.location.search).get('screen')
        const { screen, params } = requested ? resolveScreen(requested) : { screen: home(), params: {} }
        state.screen = screen
        state.params = params
      },
    },
  ),
)
