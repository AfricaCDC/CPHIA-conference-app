import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import SessionCard from '../components/SessionCard'
import { api, listOf } from '../lib/api'
import { useEventSlug, useProgramme } from '../lib/useParticipant'
import { useRemote } from '../lib/useRemote'
import { useAppStore } from '../store/appStore'
import { useSessionStore } from '../store/sessionStore'

const DELAY_MS = 250

function Section({ title, count, children }) {
  if (!count) return null
  return (
    <section className="flex flex-col">
      <h2 className="px-1 pb-1 pt-3 text-xs font-extrabold uppercase tracking-[.6px] text-muted">{title}</h2>
      {children}
    </section>
  )
}

/** Search across the programme, speakers, venues and, when signed in, delegates. Opens from the header. */
export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [people, setPeople] = useState([])
  const signedIn = useSessionStore((state) => Boolean(state.token))
  const slug = useEventSlug()
  const navigateTo = useAppStore((state) => state.navigateTo)
  const { sessions } = useProgramme()
  // The server searches the speakers, so a search only fetches the matches.
  const speakers = useRemote(term ? `/events/${encodeURIComponent(slug)}/speakers?per_page=50&q=${encodeURIComponent(term)}` : null)
  const venues = useRemote(`/events/${encodeURIComponent(slug)}/venues`)

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  // Delegates are personal: only signed-in users search them.
  useEffect(() => {
    if (!signedIn || term.length < 2) { setPeople([]); return undefined }
    const controller = new AbortController()
    api(`/events/${encodeURIComponent(slug)}/attendees?per_page=20&search=${encodeURIComponent(term)}`, { signal: controller.signal })
      .then((payload) => setPeople(listOf(payload)))
      .catch(() => {})
    return () => controller.abort()
  }, [signedIn, slug, term])

  const needle = term.toLowerCase()
  const match = (...fields) => needle && fields.some((f) => f?.toLowerCase().includes(needle))
  const matchedSessions = useMemo(
    () => (needle ? sessions.filter((s) => match(s.title, s.hall?.name, s.venue?.name, ...(s.speakers ?? []).map((sp) => sp.name))) : []),
    [sessions, needle], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const matchedSpeakers = needle ? listOf(speakers.data) : []
  const matchedHalls = needle
    ? listOf(venues.data).flatMap((venue) => (venue.halls ?? []).filter((h) => match(h.name, venue.name)).map((h) => ({ ...h, venue })))
    : []
  const total = matchedSessions.length + matchedSpeakers.length + matchedHalls.length + people.length

  return (
    <>
      <header className="hdr sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <button type="button" className="iconbtn" onClick={() => navigateTo('home')} aria-label="Close search">
            <X size={20} aria-hidden="true" />
          </button>
          <label className="hdr-search flex min-w-0 flex-1 items-center gap-2 rounded-full px-3.5 py-2.5">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search the conference</span>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sessions, speakers, rooms, people"
              className="min-w-0 flex-1 border-0 bg-transparent px-0 text-[15px] outline-none"
            />
          </label>
        </div>
      </header>
      <div className="flex flex-col gap-1 px-4 pb-4 pt-2">
        {!needle && <div className="empty">Search sessions, speakers, rooms{signedIn ? ' and delegates' : ''}.</div>}
        {needle && total === 0 && <div className="empty">Nothing matches “{term}”.</div>}

        <Section title="Sessions" count={matchedSessions.length}>
          {matchedSessions.slice(0, 20).map((session) => <SessionCard key={session.id} session={session} />)}
        </Section>

        <Section title="Speakers" count={matchedSpeakers.length}>
          {matchedSpeakers.slice(0, 20).map((speaker) => (
            <button key={speaker.id} type="button" className="flex items-center gap-3 border-b border-line py-3 text-left" onClick={() => navigateTo('speakers')}>
              <Avatar name={speaker.name} photoUrl={speaker.photo_url ?? speaker.external_photo_url} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{speaker.name}</span>
                <span className="text-[13px] text-muted">{[speaker.title, speaker.organization].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
        </Section>

        <Section title="Rooms" count={matchedHalls.length}>
          {matchedHalls.slice(0, 20).map((hall) => (
            <button key={`${hall.venue.id}-${hall.id}`} type="button" className="flex items-center gap-3 border-b border-line py-3 text-left" onClick={() => navigateTo('venues')}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{hall.name}</span>
                <span className="text-[13px] text-muted">{hall.venue.name}</span>
              </span>
            </button>
          ))}
        </Section>

        <Section title="Delegates" count={people.length}>
          {people.slice(0, 20).map((person) => (
            <button key={person.public_id} type="button" className="flex items-center gap-3 border-b border-line py-3 text-left" onClick={() => navigateTo('attendee', { publicId: person.public_id })}>
              <Avatar name={person.name} photoUrl={person.photo_url} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{person.name}</span>
                <span className="text-[13px] text-muted">{[person.job_title, person.organization].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
        </Section>
      </div>
    </>
  )
}
