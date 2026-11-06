import Card, { CardButton } from '../../components/ui/Card'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, MapPin, Navigation } from 'lucide-react'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import SearchField from '../../components/ui/SearchField'
import FloorPlan from '../../components/FloorPlan'
import { hhmm } from '../../components/SessionCard'
import { api, listOf } from '../../lib/api'
import { useEventSlug, useProgramme } from '../../lib/useParticipant'
import { useRefreshListener } from '../../lib/useRefreshListener'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

const PAGE = 50
const SEARCH_DELAY_MS = 300

function nowParts() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return { date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, time: `${pad(now.getHours())}:${pad(now.getMinutes())}:00` }
}

/** Every room, 50 to a page from the server, with search. Infinite scroll loads the next page; tap a room for its detail. */
/** A venue: its place and how to get there, with map navigation when it has coordinates. */
function VenueCard({ venue, onOpenMap }) {
  const hasPoint = venue.latitude != null && venue.longitude != null
  return (
    <Card className="card flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[17px] font-extrabold">{venue.name}</span>
        {venue.location && <span className="text-[13px] text-muted">{venue.location}</span>}
      </div>
      {venue.directions_notes && <p className="whitespace-pre-line text-[14px] leading-relaxed">{venue.directions_notes}</p>}
      <FloorPlan url={venue.floor_plan_url} kind={venue.floor_plan_kind} title={venue.name} />
      {hasPoint && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onOpenMap} className="btn o sm"><MapPin size={16} aria-hidden="true" />Map</button>
          <a href={venue.google_directions_url} target="_blank" rel="noopener noreferrer" className="btn sm"><Navigation size={16} aria-hidden="true" />Navigate</a>
        </div>
      )}
    </Card>
  )
}

export function VenueBoards() {
  const slug = useEventSlug()
  const navigateTo = useAppStore((state) => state.navigateTo)
  const venues = listOf(useRemote(`/events/${encodeURIComponent(slug)}/venues`).data)
  const { sessions } = useProgramme()
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [rooms, setRooms] = useState([])
  const [page, setPage] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const sentinel = useRef(null)
  const { date, time } = nowParts()

  // Wait for a pause in typing, then search from the first page.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  async function loadPage(nextPage, search, signal, replace = false) {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ per_page: PAGE, page: nextPage, ...(search ? { q: search } : {}) })
      const payload = await api(`/events/${encodeURIComponent(slug)}/halls?${qs}`, { signal })
      setRooms((current) => (replace ? payload.data.rows : [...current, ...payload.data.rows]))
      setPage(payload.meta.current_page)
      setLastPage(payload.meta.last_page)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err)
    } finally {
      setLoading(false)
    }
  }

  // A new search starts again from the first page of results.
  useEffect(() => {
    const controller = new AbortController()
    setRooms([])
    setPage(0)
    setLastPage(1)
    loadPage(1, term, controller.signal, true)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, slug])

  useRefreshListener(() => {
    setRooms([])
    setPage(0)
    setLastPage(1)
    loadPage(1, term, undefined, true)
  })

  // Load the next page when the end of the list comes into view.
  useEffect(() => {
    const node = sentinel.current
    if (!node || loading || page >= lastPage) return undefined
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadPage(page + 1, term), { rootMargin: '200px' })
    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lastPage, loading, term])

  const todays = sessions.filter((s) => s.date === date && s.hall?.id)
  function statusOf(hall) {
    const live = todays.find((s) => s.hall.id === hall.id && s.start_time <= time && time < s.end_time)
    if (live) return { state: 'live', label: 'Live now', text: `${live.title} · until ${hhmm(live.end_time)}` }
    const next = todays.filter((s) => s.hall.id === hall.id && s.start_time > time).sort((a, b) => a.start_time.localeCompare(b.start_time))[0]
    if (next) return { state: 'next', label: 'Next', text: `${next.title} · ${hhmm(next.start_time)}` }
    return { state: 'open', label: 'Open', text: 'Nothing scheduled today' }
  }

  return (
    <div className="flex flex-col gap-3">
      {venues.map((venue) => (
        <VenueCard key={venue.id} venue={venue} onOpenMap={() => navigateTo('directions', { kicker: 'Venue', title: venue.name, latitude: venue.latitude ?? null, longitude: venue.longitude ?? null, notes: venue.directions_notes ?? null, floorPlanUrl: venue.floor_plan_url ?? null })} />
      ))}
      <h2 className="h3">Rooms</h2>
      <SearchField label="Search rooms" value={query} onChange={setQuery} placeholder="Search rooms and venues" />
      <LoadState loading={loading && rooms.length === 0} error={error && rooms.length === 0 ? error : null} onRetry={() => loadPage(1, term, undefined, true)}>
        {rooms.length === 0 && !loading && <div className="empty">{term ? `No room matches “${term}”.` : 'Venue details will be published soon.'}</div>}
        <ul className="flex flex-col gap-2.5">
          {rooms.map((hall) => {
            const status = statusOf(hall)
            return (
              <li key={`${hall.venue.id}-${hall.id}`}>
                <CardButton onClick={() => navigateTo('hall', { hall })} className="row w-full items-center text-left active:scale-[.99]">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/25 text-tertiary"><MapPin size={20} aria-hidden="true" /></span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[16px] font-extrabold">{hall.name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${status.state === 'live' ? 'bg-maroon text-cream' : status.state === 'next' ? 'bg-secondary text-ink' : 'bg-primary/25 text-tertiary'}`}>{status.label}</span>
                    </span>
                    <span className="truncate text-[12px] text-muted">{hall.venue.name}</span>
                    <span className="truncate text-[13px] text-muted">{status.text}</span>
                  </span>
                  <ChevronRight size={20} className="shrink-0 opacity-50" aria-hidden="true" />
                </CardButton>
              </li>
            )
          })}
        </ul>
        {(loading && rooms.length > 0) || page < lastPage ? (
          <div ref={sentinel} className="py-4 text-center text-[13px] text-muted" role="status">Loading more rooms…</div>
        ) : null}
      </LoadState>
    </div>
  )
}

export default function VenuesScreen() {
  return (
    <>
      <ScreenHeader kicker="Venue" title="Rooms" back />
      <Body>
        <VenueBoards />
      </Body>
    </>
  )
}

