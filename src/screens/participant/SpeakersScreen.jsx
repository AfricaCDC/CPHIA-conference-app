import { useEffect, useRef, useState } from 'react'
import SearchField from '../../components/ui/SearchField'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { initials } from '../../components/ui/Avatar'
import { api, listOf } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRefreshListener } from '../../lib/useRefreshListener'
import { useAppStore } from '../../store/appStore'

/** A speaker tile: portrait, keynote badge, name and organisation. Tap for the bio. */
function SpeakerTile({ speaker, onOpen }) {
  // The resized copy keeps the grid light; the original is the fallback for linked photos.
  const photo = speaker.photo_thumb_url ?? speaker.photo_url ?? speaker.external_photo_url
  const [failed, setFailed] = useState(false)
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col gap-2 text-left">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-primary/20 shadow-sm transition group-active:scale-[.98]">
        {photo && !failed ? (
          <img src={photo} alt="" loading="lazy" decoding="async" width="200" height="250" onError={() => setFailed(true)} className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-3xl font-black text-teal-dark" aria-hidden="true">{initials(speaker.name)}</span>
        )}
        {speaker.is_keynote && (
          <span className="absolute left-2 top-2 rounded-full bg-sun px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink">Keynote</span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/70 to-transparent" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <span className="line-clamp-2 text-[14px] font-extrabold leading-snug">{speaker.name}</span>
        <span className="line-clamp-2 text-[12px] leading-snug text-muted">{[speaker.title, speaker.organization].filter(Boolean).join(' · ')}</span>
      </div>
    </button>
  )
}

const PAGE_SIZE = 20
const SEARCH_DELAY_MS = 300

/** Speakers as a grid of portraits, 20 at a time as you scroll, with search on the server. Tap a speaker for the bio. */
export default function SpeakersScreen() {
  const slug = useEventSlug()
  const base = `/events/${encodeURIComponent(slug)}/speakers`
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [speakers, setSpeakers] = useState([])
  const [page, setPage] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const sentinel = useRef(null)

  // Wait for a pause in typing, then search from the first page.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  // A new search starts again from page 1.
  useEffect(() => {
    const controller = new AbortController()
    setSpeakers([])
    setPage(0)
    setLastPage(1)
    setError(null)
    fetchPage(1, term, controller.signal, true)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, base])

  useRefreshListener(() => {
    setSpeakers([])
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
      setSpeakers((current) => (replace ? listOf(payload) : [...current, ...listOf(payload)]))
      setPage(payload.meta?.current_page ?? nextPage)
      setLastPage(payload.meta?.last_page ?? nextPage)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err)
    } finally {
      setLoading(false)
    }
  }

  // Load the next page when the bottom of the grid comes into view.
  useEffect(() => {
    const node = sentinel.current
    if (!node || loading || page >= lastPage) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchPage(page + 1, term)
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lastPage, loading, term, base])

  return (
    <>
      <ScreenHeader kicker="Programme" title="Speakers" back>
        <SearchField label="Search speakers" value={query} onChange={setQuery} placeholder="Search speakers" />
      </ScreenHeader>
      <Body className="px-4">
        {speakers.length === 0 && !loading && !error ? (
          <div className="empty">{term ? 'No speaker matches your search.' : 'Speakers will be announced soon.'}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {speakers.map((speaker) => <SpeakerTile key={speaker.id} speaker={speaker} onOpen={() => navigateTo('speaker', { id: speaker.id, speaker })} />)}
            </div>
            <div ref={sentinel} className="py-4 text-center text-[13px] text-muted" role="status">
              {error ? 'Could not load more. Scroll again to retry.' : loading ? 'Loading…' : page >= lastPage && speakers.length ? 'That is everyone.' : ''}
            </div>
          </>
        )}
      </Body>
    </>
  )
}
