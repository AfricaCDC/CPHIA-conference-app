import Card from '../../components/ui/Card'
import SessionCard from '../../components/SessionCard'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { formatDayLong } from '../../lib/format'
import { useProgramme } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

const overlaps = (a, b) => a.date === b.date && a.start_time < b.end_time && b.start_time < a.end_time

/** Sessions the delegate saved, by day, with clashes flagged. */
export default function ScheduleScreen() {
  const schedule = useAppStore((state) => state.schedule)
  const { sessions, loading, error, reload } = useProgramme()
  const mine = sessions.filter((s) => schedule.includes(s.id))
  const days = [...new Set(mine.map((s) => s.date))]
  const clashes = mine.filter((a) => mine.some((b) => b.id !== a.id && overlaps(a, b)))

  return (
    <>
      <ScreenHeader kicker="My schedule" title="Sessions I am attending" back />
      <Body>
        <LoadState loading={loading && !sessions.length} error={error} onRetry={reload}>
          {mine.length === 0 && <div className="empty">Nothing saved yet. Open the programme and tap +.</div>}
          {days.map((day) => (
            <div key={day} className="flex flex-col gap-2.5">
              <span className="lab">{formatDayLong(day)}</span>
              {mine.filter((s) => s.date === day).map((session) => <SessionCard key={session.id} session={session} />)}
            </div>
          ))}
          <Card className={`card ${clashes.length ? 'yellow' : 'mint'}`}>
            <span className="t">{clashes.length ? `${clashes.length} sessions overlap` : 'Clashes'}</span>
            <span className="s">{clashes.length ? clashes.map((s) => s.title).join(' · ') : 'We flag saved sessions that overlap. Your schedule is kept on this phone.'}</span>
          </Card>
        </LoadState>
      </Body>
    </>
  )
}
