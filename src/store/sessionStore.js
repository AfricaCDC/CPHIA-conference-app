import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** Zustand persist key (full session snapshot). */
export const SESSION_STORAGE_KEY = 'cphia-pwa-session'
/**
 * Bare token mirror written on every sign-in. Survives zustand schema bumps / partial
 * persist wipes so an app update does not force another OTP unless the user signs out.
 */
export const SESSION_TOKEN_BACKUP_KEY = 'cphia-pwa-auth-token'

const SESSION_FIELDS = ['token', 'user', 'capabilities', 'scanner', 'staffDesks', 'deskKey', 'eventSlug', 'registrationUrl']

function readBackupToken() {
  try {
    const value = localStorage.getItem(SESSION_TOKEN_BACKUP_KEY)
    return value && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

function writeBackupToken(token) {
  try {
    if (token) localStorage.setItem(SESSION_TOKEN_BACKUP_KEY, token)
    else localStorage.removeItem(SESSION_TOKEN_BACKUP_KEY)
  } catch {
    /* private mode / quota */
  }
}

function snapshotSession(state) {
  return SESSION_FIELDS.reduce((acc, key) => {
    acc[key] = state[key] ?? null
    return acc
  }, {})
}

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
      signIn: ({ token, user, capabilities, scanner, staff_desks: staffDesks = [], current_conference: conference, registration_url: registrationUrl = null }, fallbackSlug) => {
        writeBackupToken(token)
        set({ token, user, capabilities, scanner, staffDesks, registrationUrl, deskKey: staffDesks[0]?.key ?? null, eventSlug: conference?.slug ?? fallbackSlug })
      },
      // /auth/me refresh: picks up a new photo, profile edits or changed roles.
      setSession: ({ user, capabilities, scanner, staff_desks: staffDesks = [], registration_url: registrationUrl = null }) => {
        const deskKey = staffDesks.some((desk) => desk.key === get().deskKey) ? get().deskKey : staffDesks[0]?.key ?? null
        set({ user, capabilities, scanner, staffDesks, registrationUrl, deskKey })
        // Keep the durable token mirror in sync while the session is live.
        writeBackupToken(get().token)
      },
      setUser: (user) => set({ user }),
      // A user with several admin roles picks which desk the staff app shows.
      setDeskKey: (deskKey) => set({ deskKey }),
      signOut: () => {
        writeBackupToken(null)
        set({ token: null, user: null, capabilities: null, scanner: null, staffDesks: [], deskKey: null })
      },

      // Inbox unread count, refreshed by useInbox and shown on the header.
      unread: 0,
      setUnread: (unread) => set({ unread }),
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Older installs saved state without a version; without migrate zustand skips rehydrate.
      migrate: (persisted) => (persisted && typeof persisted === 'object' ? persisted : {}),
      partialize: (state) => snapshotSession(state),
      // If the zustand blob is missing/corrupt but the backup token remains, restore enough
      // to stay signed in after an update; /auth/me then fills user/roles.
      merge: (persisted, current) => {
        const fromPersist = persisted && typeof persisted === 'object' ? persisted : {}
        const token = fromPersist.token || readBackupToken() || current.token || null
        if (token) writeBackupToken(token)
        return {
          ...current,
          ...fromPersist,
          token,
          staffDesks: Array.isArray(fromPersist.staffDesks) ? fromPersist.staffDesks : current.staffDesks,
        }
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          const token = readBackupToken()
          if (token) useSessionStore.setState({ token })
          return
        }
        const token = state?.token || readBackupToken()
        if (token && !state?.token) {
          useSessionStore.setState({ token })
        }
        if (token) writeBackupToken(token)
      },
    },
  ),
)

/** True once localStorage has been read — avoids treating a still-hydrating session as signed out. */
export function useSessionHydrated() {
  const [hydrated, setHydrated] = useState(() => useSessionStore.persist.hasHydrated())
  useEffect(() => {
    if (useSessionStore.persist.hasHydrated()) {
      setHydrated(true)
      return undefined
    }
    return useSessionStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])
  return hydrated
}
