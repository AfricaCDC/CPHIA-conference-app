import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * The signed-in user and what the server lets them do. One sign-in for everyone:
 * `capabilities` and `staffDesks` (one per admin role, from the server) decide what the app shows.
 * The bearer token is a "mobile-pwa" token, revoked on sign-out or after 14 days idle.
 */
export const useSessionStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      capabilities: null,
      scanner: null,
      staffDesks: [],
      deskKey: null,
      eventSlug: null,
      registrationUrl: null,
      signIn: ({ token, user, capabilities, scanner, staff_desks: staffDesks = [], current_conference: conference, registration_url: registrationUrl = null }, fallbackSlug) =>
        set({ token, user, capabilities, scanner, staffDesks, registrationUrl, deskKey: staffDesks[0]?.key ?? null, eventSlug: conference?.slug ?? fallbackSlug }),
      // /auth/me refresh: picks up a new photo, profile edits or changed roles.
      setSession: ({ user, capabilities, scanner, staff_desks: staffDesks = [], registration_url: registrationUrl = null }) => {
        const deskKey = staffDesks.some((desk) => desk.key === get().deskKey) ? get().deskKey : staffDesks[0]?.key ?? null
        set({ user, capabilities, scanner, staffDesks, registrationUrl, deskKey })
      },
      setUser: (user) => set({ user }),
      // A user with several admin roles picks which desk the staff app shows.
      setDeskKey: (deskKey) => set({ deskKey }),
      signOut: () => set({ token: null, user: null, capabilities: null, scanner: null, staffDesks: [], deskKey: null }),

      // Inbox unread count, refreshed by useInbox and shown on the header.
      unread: 0,
      setUnread: (unread) => set({ unread }),
    }),
    {
      name: 'cphia-pwa-session',
      partialize: ({ token, user, capabilities, scanner, staffDesks, deskKey, eventSlug, registrationUrl }) => ({ token, user, capabilities, scanner, staffDesks, deskKey, eventSlug, registrationUrl }),
    },
  ),
)
