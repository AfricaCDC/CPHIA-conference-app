import { useEffect } from 'react'
import AttendingGraphicCard from '../components/AttendingGraphicCard'
import ScreenHeader, { Body } from '../components/ui/ScreenHeader'
import { attendingCopy } from '../lib/attendingPhase'
import { useAttendingNudgeStore } from '../store/attendingNudgeStore'
import { useBrandStore } from '../store/brandStore'
import { useSessionStore } from '../store/sessionStore'

/** Full-screen attending share graphic (Action center / deep link). */
export default function AttendingGraphicScreen() {
  const user = useSessionStore((state) => state.user)
  const startDate = useBrandStore((state) => state.startDate)
  const endDate = useBrandStore((state) => state.endDate)
  const dismissNudge = useAttendingNudgeStore((state) => state.dismiss)
  const copy = attendingCopy(startDate, endDate)

  useEffect(() => {
    dismissNudge()
  }, [dismissNudge])

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
