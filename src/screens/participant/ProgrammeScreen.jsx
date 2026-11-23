import { useEffect, useMemo, useState } from 'react'
import { Mic2, Search } from 'lucide-react'
import SessionCard from '../../components/SessionCard'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body, Chips, HeaderIcon } from '../../components/ui/ScreenHeader'
import { matchesProgrammeSearch, programmeWallClock, sessionTimeStatus } from '../../lib/programmeTime'
import { useProgramme } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'mine', label: 'My schedule' },
  { id: 'plen', label: 'Plenary' },
  { id: 'cere', label: 'Ceremony' },
  { id: 'abs', label: 'Abstracts' },
  { id: 'side', label: 'Side Events' },
  { id: 'sess', label: 'Special sessions' },
  { id: 'net', label: 'Networking' },
]

const TIME_FILTERS = [
  { id: 'all', label: 'All times' },
  { id: 'ongoing', label: 'Happening now' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'finished', label: 'Finished' },
]

const matchesType = {
  all: () => true,
  plen: (s) => ['plenary', 'keynote'].includes(s.programme_type),
  cere: (s) => s.programme_type === 'ceremony',
  abs: (s) => ['abstract', 'session'].includes(s.programme_type),
  side: (s) => s.programme_type === 'side_event',
  sess: (s) => ['special_session', 'other', 'workshop'].includes(s.programme_type),
  net: (s) => ['networking', 'break', 'registration'].includes(s.programme_type),
}

const dayChip = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })

/** Live programme by day, with search, time status and type filters. */
export default function ProgrammeScreen() {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const schedule = useAppStore((state) => state.schedule)
  const { sessions, loading, error, reload } = useProgramme()
  const days = useMemo(() => [...new Set(sessions.map((s) => s.date).filter(Boolean))], [sessions])
  const [day, setDay] = useState(null)
  const [filter, setFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [dayReady, setDayReady] = useState(false)

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    if (dayReady || days.length === 0) return
    const today = programmeWallClock(now).dateKey
    if (days.includes(today)) setDay(today)
    setDayReady(true)
  }, [days, now, dayReady])

  const activeDay = day ?? days[0]
  const visible = sessions.filter((s) => {
    if (s.date !== activeDay) return false
    if (filter === 'mine' ? !schedule.includes(s.id) : !matchesType[filter](s)) return false
    if (timeFilter !== 'all' && sessionTimeStatus(s, now) !== timeFilter) return false
    if (!matchesProgrammeSearch(s, search)) return false
    return true
  })

  return (
    <>
      <ScreenHeader kicker="Programme" title="Sessions, speakers, rooms" right={<HeaderIcon icon={Mic2} label="Speakers" onClick={() => navigateTo('speakers')} />}>
        <label className="mt-2 flex min-h-11 items-center gap-2 rounded-full border border-line bg-cream px-3.5">
          <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Search the programme</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions, speakers, rooms"
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[14px] outline-none placeholder:text-muted"
          />
        </label>
        {days.length > 0 && <Chips label="Day" options={days.map((d) => ({ id: d, label: dayChip(d) }))} value={activeDay} onChange={setDay} />}
        <Chips label="Time" options={TIME_FILTERS} value={timeFilter} onChange={setTimeFilter} />
        <Chips label="Filter" options={TYPE_FILTERS} value={filter} onChange={setFilter} />
      </ScreenHeader>
      <Body>
        <LoadState loading={loading && !sessions.length} error={error} onRetry={reload}>
          {visible.map((session) => <SessionCard key={session.id} session={session} now={now} />)}
          {visible.length === 0 && (
            <div className="empty">
              {sessions.length
                ? (search.trim()
                  ? 'No sessions match this search for this day.'
                  : 'No sessions match these filters for this day.')
                : 'The programme has not been published yet.'}
            </div>
          )}
          <p className="foot">★ saved to my schedule · tap a session for speakers, room and sub-sessions</p>
        </LoadState>
      </Body>
    </>
  )
}
