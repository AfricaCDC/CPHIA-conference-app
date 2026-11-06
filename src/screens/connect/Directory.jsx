import Card, { CardButton } from '../../components/ui/Card'
import { useEffect, useState } from 'react'
import Avatar from '../../components/ui/Avatar'
import { LoadState } from '../../components/ui/LoadState'
import { api, listOf } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRefreshListener } from '../../lib/useRefreshListener'
import { useAppStore } from '../../store/appStore'
import { startChat } from './AttendeeScreen'

const PER_PAGE = 30
const SEARCH_DELAY_MS = 300

/** A person row inside a card list (contacts, chats). */
export function PersonRow({ person, subtitle, onClick, trailing }) {
  return (
    <CardButton onClick={onClick} className="row w-full text-left">
      <Avatar name={person.name} photoUrl={person.photo_url} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t block truncate">{person.name}</span>
        <span className="s block truncate">{subtitle ?? [person.job_title, person.organization].filter(Boolean).join(' · ')}</span>
      </span>
      {trailing}
    </CardButton>
  )
}

/** A delegate card as in the wireframe: who they are, then Connect / Message. */
function PersonCard({ person, connected, onConnect, onMessage, busy }) {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const meta = [person.job_title, person.sector, person.networking_headline].filter(Boolean).join(' · ')

  return (
    <Card className="card">
      <button type="button" className="flex items-center gap-3 text-left" onClick={() => navigateTo('attendee', { publicId: person.public_id })}>
        <Avatar name={person.name} photoUrl={person.photo_url} />
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="t">{person.name}</span>
          {person.organization && <span className="s">{person.organization}</span>}
          {(meta || person.interests?.length > 0) && <span className="s">{[meta, (person.interests ?? []).join(', ')].filter(Boolean).join(' · ')}</span>}
        </span>
      </button>
      {person.is_self ? (
        <span className="pill self-start">You</span>
      ) : (
        <div className="flex gap-2">
          <button type="button" className="btn sm flex-1" disabled={busy} onClick={onMessage}>Message</button>
          {connected ? (
            <span className="pill t flex-1 text-center leading-7">Connected ✓</span>
          ) : (
            <button type="button" className="btn o sm flex-1" disabled={busy} onClick={onConnect}>Connect</button>
          )}
        </div>
      )}
    </Card>
  )
}

/** Searchable delegate directory. `filter` "mine" shows only saved contacts. */
export default function Directory({ query, filter = 'all', onTotal }) {
  const slug = useEventSlug()
  const navigateTo = useAppStore((state) => state.navigateTo)
  const showToast = useAppStore((state) => state.showToast)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ items: [], lastPage: 1, loading: true, error: null })
  const [connected, setConnected] = useState(new Set())
  const [busy, setBusy] = useState(null)
  const base = `/events/${encodeURIComponent(slug)}`

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1) }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    api(`${base}/connections`).then((payload) => setConnected(new Set(listOf(payload).map((c) => c.registration_public_id)))).catch(() => {})
  }, [base])

  useEffect(() => {
    const controller = new AbortController()
    setState((previous) => ({ ...previous, loading: true, error: null }))
    const qs = new URLSearchParams({ per_page: PER_PAGE, page, ...(search ? { search } : {}) })
    api(`${base}/attendees?${qs}`, { signal: controller.signal })
      .then((payload) => {
        onTotal?.(payload.meta?.total ?? 0)
        setState((previous) => ({
          items: page === 1 ? listOf(payload) : [...previous.items, ...listOf(payload)],
          lastPage: payload.meta?.last_page ?? 1,
          loading: false,
          error: null,
        }))
      })
      .catch((error) => error.name !== 'AbortError' && setState((previous) => ({ ...previous, loading: false, error })))
    return () => controller.abort()
  }, [base, search, page, onTotal])

  useRefreshListener(() => {
    api(`${base}/connections`).then((payload) => setConnected(new Set(listOf(payload).map((c) => c.registration_public_id)))).catch(() => {})
    if (page === 1) {
      setState((previous) => ({ ...previous, loading: true, error: null }))
      const qs = new URLSearchParams({ per_page: PER_PAGE, page: 1, ...(search ? { search } : {}) })
      api(`${base}/attendees?${qs}`)
        .then((payload) => {
          onTotal?.(payload.meta?.total ?? 0)
          setState({
            items: listOf(payload),
            lastPage: payload.meta?.last_page ?? 1,
            loading: false,
            error: null,
          })
        })
        .catch((error) => setState((previous) => ({ ...previous, loading: false, error })))
    } else {
      setPage(1)
    }
  })

  async function act(person, action) {
    setBusy(person.public_id)
    try {
      await action()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(null)
    }
  }

  const connect = (person) =>
    act(person, async () => {
      await api(`${base}/connections`, { method: 'POST', body: { registration_public_id: person.public_id } })
      setConnected(new Set([...connected, person.public_id]))
      showToast(`Connected with ${person.name}`)
    })

  const message = (person) =>
    act(person, async () => {
      const { data } = await api(`${base}/attendees/${encodeURIComponent(person.public_id)}`)
      await startChat(slug, data, navigateTo)
    })

  const items = filter === 'mine' ? state.items.filter((p) => connected.has(p.public_id)) : state.items

  return (
    <LoadState loading={state.loading && state.items.length === 0} error={state.items.length === 0 ? state.error : null} onRetry={() => setPage(1)}>
      {items.length === 0 && (
        <div className="empty">
          {filter === 'mine' ? 'No connections yet. Tap Connect on a delegate, or scan their badge QR.' : search ? `Nobody matches “${search}”.` : 'No delegates are visible yet.'}
        </div>
      )}
      {items.map((person) => (
        <PersonCard key={person.public_id} person={person} connected={connected.has(person.public_id)} busy={busy === person.public_id} onConnect={() => connect(person)} onMessage={() => message(person)} />
      ))}
      {page < state.lastPage && (
        <button type="button" className="btn o" disabled={state.loading} onClick={() => setPage(page + 1)}>{state.loading ? 'Loading…' : 'Load more'}</button>
      )}
    </LoadState>
  )
}
