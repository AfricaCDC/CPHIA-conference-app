import { Bell, ScanLine, UserRound } from 'lucide-react'
import ScreenHeader, { Body } from '../components/ui/ScreenHeader'
import { useRoles } from '../lib/roles'
import { useAppStore } from '../store/appStore'
import { useSessionStore } from '../store/sessionStore'

/** For users who are both a delegate and staff: pick the app to open. The choice is remembered and can be changed in More. */
export default function ChooserScreen() {
  const user = useSessionStore((state) => state.user)
  const roles = useRoles()
  const setMode = useAppStore((state) => state.setMode)
  const switchTab = useAppStore((state) => state.switchTab)

  function open(mode, screen) {
    setMode(mode)
    switchTab(screen)
  }

  return (
    <>
      <ScreenHeader kicker="Welcome back" title={user?.name ?? 'Choose your app'} />
      <Body>
        <p className="text-[14px] text-muted">You have both a delegate and a staff role. Which app would you like to open?</p>
        <button type="button" onClick={() => open('delegate', 'home')} className="lift flex flex-col gap-3 rounded-3xl bg-gradient-to-br from-tertiary to-primary p-5 text-left text-cream active:scale-[.99]">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/20"><UserRound size={24} aria-hidden="true" /></span>
          <span className="text-[20px] font-extrabold">Delegate app</span>
          <span className="text-[13px] text-cream/90">Your badge, schedule, travel, hotel, finance, messages and networking.</span>
        </button>
        <button type="button" onClick={() => open('staff', 'shome')} className="lift flex flex-col gap-3 rounded-3xl bg-white p-5 text-left active:scale-[.99]">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/25 text-tertiary"><ScanLine size={24} aria-hidden="true" /></span>
          <span className="text-[20px] font-extrabold">Staff desk</span>
          <span className="text-[13px] text-muted">{roles.desks.map((desk) => desk.label).join(' · ') || 'Your desk and tools'}</span>
        </button>
        <p className="flex items-center gap-2 text-[12px] text-muted"><Bell size={14} aria-hidden="true" />You can switch any time from More.</p>
      </Body>
    </>
  )
}
