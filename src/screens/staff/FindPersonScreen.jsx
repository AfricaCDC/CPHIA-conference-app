import Card from '../../components/ui/Card'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import ScanPersonCard from '../../components/ScanPersonCard'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import StaffHeaderActions from '../../components/ui/StaffHeaderActions'
import SearchField from '../../components/ui/SearchField'
import { api, listOf } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRefreshListener } from '../../lib/useRefreshListener'
import { useRoles } from '../../lib/roles'
import { useAppStore } from '../../store/appStore'

const PAGE_SIZE = 20
const SEARCH_DELAY_MS = 300

/** Participants in pages of 20, loaded as you scroll (infinite scroll). Search runs on the server. */
export default function FindPersonScreen() {
  const slug = useEventSlug()
  const { canViewAllPeople, canViewPeople } = useRoles()
  const showToast = useAppStore((state) => state.showToast)
  const base = `/events/${encodeURIComponent(slug)}/participants${canViewAllPeople ? '' : '/approved'}`
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [people, setPeople] = useState([])
  const [page, setPage] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const sentinel = useRef(null)

  // Wait for a pause in typing, then search from the first page.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  // A new search starts again from page 1.
  useEffect(() => {
    if (!canViewPeople) return undefined
    const controller = new AbortController()
    setPeople([])
    setPage(0)
    setLastPage(1)
    setError(null)
    setSelected(null)
    fetchPage(1, term, controller.signal, true)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, base, canViewPeople])

  useRefreshListener(() => {
    if (!canViewPeople) return
    setPeople([])
    setPage(0)
    setLastPage(1)
    setError(null)
    fetchPage(1, term, undefined, true)
  })

  async function fetchPage(nextPage, search, signal, replace = false) {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ per_page: PAGE_SIZE, page: nextPage, ...(search ? { q: search } : {}) })
      const payload = await api(`${base}?${qs}`, { signal })
      setPeople((current) => (replace ? listOf(payload) : [...current, ...listOf(payload)]))
      setPage(payload.meta?.current_page ?? nextPage)
      setLastPage(payload.meta?.last_page ?? nextPage)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err)
    } finally {
      setLoading(false)
    }
  }

  async function openPerson(person) {
    setDetailBusy(true)
    setSelected(person)
    try {
      const { data } = await api(`/events/${encodeURIComponent(slug)}/participants/${person.id}`)
      setSelected(data)
    } catch (err) {
      showToast(err.message || 'Could not load full details', 'info')
    } finally {
      setDetailBusy(false)
    }
  }

  // Load the next page when the bottom of the list comes into view.
  useEffect(() => {
    const node = sentinel.current
    if (!node || loading || page >= lastPage || selected) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchPage(page + 1, term)
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lastPage, loading, term, base, selected])

  if (selected) {
    return (
      <>
        <ScreenHeader
          kicker="Find person"
          title={selected.name || 'Participant'}
          tone="teal"
          right={<StaffHeaderActions find={false} />}
        >
          <button type="button" className="btn sm" onClick={() => setSelected(null)}>
            <ChevronLeft size={16} aria-hidden="true" /> Back to list
          </button>
        </ScreenHeader>
        <Body>
          {detailBusy && !selected.badge_id && selected.id ? (
            <div className="empty" role="status">Loading details…</div>
          ) : (
            <ScanPersonCard person={selected} showCheckIn={false} />
          )}
        </Body>
      </>
    )
  }

  return (
    <>
      <ScreenHeader kicker="Find person" title="Participants" tone="teal" right={<StaffHeaderActions find={false} />}>
        {canViewPeople && <SearchField label="Search participants" value={query} onChange={setQuery} placeholder="Name, email, or MoPD ID" />}
      </ScreenHeader>
      <Body>
        {!canViewPeople ? (
          <Card className="card yellow">
            <span className="t">Participant search is not on for your account</span>
            <span className="s">Ask an admin to add a participant view permission to your role under Admin users. You can still scan a badge to look someone up.</span>
          </Card>
        ) : (
          <>
            <p className="text-[12px] font-semibold text-muted">
              {people.length ? `${people.length} shown${page < lastPage ? ' · scroll for more' : ''}` : loading ? 'Searching…' : 'No one matches'}
            </p>
            <ul className="flex flex-col gap-2.5">
              {people.map((person) => (
                <li key={person.id}>
                  <button type="button" className="w-full text-left" onClick={() => openPerson(person)}>
                    <Card className="row items-center gap-3 active:scale-[.99]">
                      <Avatar name={person.name} photoUrl={person.photo_url} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-bold">{person.name}</span>
                        <span className="truncate text-[12px] text-muted">{[person.organization, person.category].filter(Boolean).join(' · ')}</span>
                        <span className="truncate text-[12px] font-semibold">
                          {[person.delegate_type || person.badge_type, person.badge_id && `Badge ${person.badge_id}`, person.nationality, person.gender].filter(Boolean).join(' · ')}
                        </span>
                        {(person.batch_number != null || person.box_number != null || person.packing?.list || person.packing?.box) && (
                          <span className="truncate text-[12px] text-muted">
                            {[
                              (person.batch_number ?? person.packing?.box ?? person.packing?.batch) != null && `Batch ${person.batch_number ?? person.packing?.box ?? person.packing?.batch}`,
                              (person.box_number ?? person.packing?.list) != null && `Box ${person.box_number ?? person.packing?.list}`,
                              person.has_plenary_access ? 'Plenary' : null,
                              person.has_car_parking_access ? 'Parking' : null,
                              person.has_redzone_plenary_access ? 'Redzone' : null,
                            ].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        <span className="truncate text-[12px] font-semibold">
                          {person.stay?.hotel
                            ? `Staying at ${person.stay.hotel}`
                            : person.stay?.hotel_covered
                              ? 'Hotel not assigned yet'
                              : 'Hotel not stated'}
                        </span>
                      </div>
                      {person.status && <Badge>{String(person.status).replace(/_/g, ' ')}</Badge>}
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
            <div ref={sentinel} className="py-4 text-center text-[13px] text-muted" role="status">
              {error ? 'Could not load more. Scroll again to retry.' : loading ? 'Loading…' : page >= lastPage && people.length ? 'That is everyone.' : ''}
            </div>
          </>
        )}
      </Body>
    </>
  )
}
