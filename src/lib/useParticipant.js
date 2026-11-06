import { buildActions, countsByScreen } from './actions'
import { useEffect } from 'react'
import { DEFAULT_EVENT_SLUG } from './api'
import { useRemote } from './useRemote'
import { useSessionStore } from '../store/sessionStore'

export function useEventSlug() {
  return useSessionStore((state) => state.eventSlug) ?? DEFAULT_EVENT_SLUG
}

/** The delegate's registration for this conference (badge, collection details, logistics). */
export function useRegistration() {
  const slug = useEventSlug()
  const { data, error, loading, reload } = useRemote(`/participant/registrations?event_slug=${encodeURIComponent(slug)}`)
  const registration = data?.data?.find((item) => item.event_slug === slug) ?? data?.data?.[0] ?? null

  return { registration, error, loading, reload }
}

/** Inbox of every action that was pushed to the delegate. Keeps the nav badge in sync. */
export function useInbox() {
  const setUnread = useSessionStore((state) => state.setUnread)
  const remote = useRemote('/participant/notifications')
  const unread = remote.data?.meta?.unread

  useEffect(() => {
    if (typeof unread === 'number') setUnread(unread)
  }, [unread, setUnread])

  return { items: remote.data?.data ?? [], unread: unread ?? 0, ...remote }
}

/** Unread 1:1 chat messages across conversations. */
export function useChatUnread() {
  const slug = useEventSlug()
  const { data } = useRemote(`/events/${encodeURIComponent(slug)}/conversations`)
  const items = data?.data ?? []
  return Array.isArray(items) ? items.reduce((sum, chat) => sum + (chat.unread_count ?? 0), 0) : 0
}

/** The live programme, sorted by day and start time. */
export function useProgramme() {
  const slug = useEventSlug()
  const remote = useRemote(`/events/${encodeURIComponent(slug)}/programme`)
  const items = remote.data?.data?.items ?? remote.data?.data ?? []
  const sessions = (Array.isArray(items) ? items : []).slice().sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`))
  return { ...remote, sessions }
}

/** Travel and finance file for the registration: itineraries, info requests, DSA, bank details, desk messaging. */
export function useLogistics(registration) {
  return useRemote(registration ? `/participant/registrations/${registration.id}/logistics` : null)
}

/** Money as "USD 1,250.00". */
export function money(amount, currency) {
  if (amount === null || amount === undefined) return null
  const value = Number(amount).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${currency} ${value}` : value
}

/** Everything that needs the delegate to act, with per-module counts for the bells. */
export function useActionCenter() {
  const { registration, loading, error, reload } = useRegistration()
  const logistics = useLogistics(registration)
  const inbox = useInbox()
  const chats = useChatUnread()
  const items = buildActions({ registration, logistics: logistics.data, updates: inbox.unread, chats })
  return { items, counts: countsByScreen(items), registration, loading: loading || logistics.loading, error: error ?? logistics.error, reload: () => { reload(); logistics.reload(); inbox.reload() } }
}
