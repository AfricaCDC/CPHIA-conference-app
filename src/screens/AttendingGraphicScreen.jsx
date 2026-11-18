import AttendingGraphicCard from '../components/AttendingGraphicCard'
import ScreenHeader, { Body } from '../components/ui/ScreenHeader'
import { attendingCopy } from '../lib/attendingPhase'
import { useBrandStore } from '../store/brandStore'
import { useSessionStore } from '../store/sessionStore'

/** Full-screen attending share graphic (Action center / deep link). */
export default function AttendingGraphicScreen() {
  const user = useSessionStore((state) => state.user)
  const startDate = useBrandStore((state) => state.startDate)
  const endDate = useBrandStore((state) => state.endDate)
  const copy = attendingCopy(startDate, endDate)

  return (
    <>
      <ScreenHeader kicker="Share" title={copy.title} back />
      <Body>
        <AttendingGraphicCard
          name={user?.name ?? ''}
          organization={user?.organization ?? ''}
          photoUrl={user?.photo_url ?? null}
        />
      </Body>
    </>
  )
}
