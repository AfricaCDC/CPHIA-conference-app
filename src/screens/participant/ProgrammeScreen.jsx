import { useMemo, useState } from 'react'
import { Mic2 } from 'lucide-react'
import SessionCard from '../../components/SessionCard'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body, Chips, HeaderIcon } from '../../components/ui/ScreenHeader'
import { useProgramme } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'My schedule' },
  { id: 'plen', label: 'Plenary & keynote' },
  { id: 'sess', label: 'Sessions' },
  { id: 'work', label: 'Workshops' },
  { id: 'net', label: 'Networking' },
]

const matches = {
  all: () => true,
  plen: (s) => ['plenary', 'keynote', 'special_session'].includes(s.programme_type),
  sess: (s) => ['session', 'other'].includes(s.programme_type),
  work: (s) => s.programme_type === 'workshop',
  net: (s) => ['networking', 'break', 'registration'].includes(s.programme_type),
}

const dayChip = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })

/** Live programme by day, with filters and the personal schedule (saved on this phone). */
export default function ProgrammeScreen() {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const schedule = useAppStore((state) => state.schedule)
  const { sessions, loading, error, reload } = useProgramme()
  const days = useMemo(() => [...new Set(sessions.map((s) => s.date).filter(Boolean))], [sessions])
  const [day, setDay] = useState(null)
  const [filter, setFilter] = useState('all')
  const activeDay = day ?? days[0]
  const visible = sessions.filter((s) => s.date === activeDay && (filter === 'mine' ? schedule.includes(s.id) : matches[filter](s)))

  return (
    <>
      <ScreenHeader kicker="Programme" title="Sessions, speakers, rooms" right={<HeaderIcon icon={Mic2} label="Speakers" onClick={() => navigateTo('speakers')} />}>
        {days.length > 0 && <Chips label="Day" options={days.map((d) => ({ id: d, label: dayChip(d) }))} value={activeDay} onChange={setDay} />}
        <Chips label="Filter" options={FILTERS} value={filter} onChange={setFilter} />
      </ScreenHeader>
      <Body>
        <LoadState loading={loading && !sessions.length} error={error} onRetry={reload}>
          {visible.map((session) => <SessionCard key={session.id} session={session} />)}
          {visible.length === 0 && <div className="empty">{sessions.length ? 'No sessions match this filter for this day.' : 'The programme has not been published yet.'}</div>}
          <p className="foot">★ saved to my schedule · tap a session for speakers, room and sub-sessions</p>
        </LoadState>
      </Body>
    </>
  )
}
