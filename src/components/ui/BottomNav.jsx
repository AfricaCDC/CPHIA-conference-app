import { IonTabBar, IonTabButton } from '@ionic/react'
import { Bus, CalendarDays, Home, ListChecks, LogIn, Map, Megaphone, MoreHorizontal, ScanLine, UserSearch, Users } from 'lucide-react'
import { useDesk, useRoles } from '../../lib/roles'
import { useAppStore } from '../../store/appStore'
import { useSessionStore } from '../../store/sessionStore'

const DESK_TAB_ICONS = { queue: ListChecks, map: Map, bus: Bus }

// The wireframe's participant tabs.
const PARTICIPANT_TABS = [
  { screen: 'home', label: 'Home', icon: Home },
  { screen: 'programme', label: 'Programme', icon: CalendarDays },
  { screen: 'transport', label: 'Transport', icon: Bus },
  { screen: 'connect', label: 'Connect', icon: Users },
  { screen: 'more', label: 'More', icon: MoreHorizontal },
]

export const STAFF_SCREENS = ['shome', 'sscan', 'sfind', 'sdesk', 'smore']

// Without an account: the public tabs, and Sign in for everything personal.
const GUEST_TABS = [
  { screen: 'home', label: 'Home', icon: Home },
  { screen: 'programme', label: 'Programme', icon: CalendarDays },
  { screen: 'venues', label: 'Venue', icon: Map },
  { screen: 'announcements', label: 'News', icon: Megaphone },
  { screen: 'signin', label: 'Sign in', icon: LogIn },
]

// Screens reached from a tab keep that tab highlighted.
const PARENT_TAB = {
  schedule: 'programme', session: 'programme', speakers: 'programme',
  attendee: 'connect', card: 'connect', lounge: 'connect', chat: 'connect',
}

/** Staff tabs: My desk, Scan, Find person, the desk's own tab (Venue, Fleet, Groups…), More. */
function staffTabs(desk) {
  return [
    { screen: 'shome', label: 'My desk', icon: ListChecks },
    { screen: 'sscan', label: 'Scan', icon: ScanLine },
    { screen: 'sfind', label: 'Find person', icon: UserSearch },
    { screen: 'sdesk', label: desk?.tab.label ?? 'Venue', icon: DESK_TAB_ICONS[desk?.tab.icon] ?? Map },
    { screen: 'smore', label: 'More', icon: MoreHorizontal },
  ]
}

export default function BottomNav() {
  const screen = useAppStore((state) => state.screen)
  const switchTab = useAppStore((state) => state.switchTab)
  const roles = useRoles()
  const desk = useDesk()
  const mode = useAppStore((state) => state.mode)
  const staffSide = STAFF_SCREENS.includes(screen) || !roles.isParticipant || (roles.isStaff && mode === 'staff')
  const signedIn = useSessionStore((state) => Boolean(state.token))
  const tabs = !signedIn ? GUEST_TABS : staffSide ? staffTabs(desk) : PARTICIPANT_TABS
  const current = PARENT_TAB[screen] ?? screen

  return (
    // Ionic's components do not pass React click handlers through, and Ionic's tab button stops
    // the click. The tap is read on this wrapper in the capture phase, before either happens.
    <div className="contents" onClickCapture={(event) => {
      const button = event.target.closest?.('ion-tab-button[data-tab]')
      if (!button) return
      event.preventDefault()
      switchTab(button.dataset.tab)
    }}>
    <IonTabBar aria-label="Main" className="app-tabbar absolute inset-x-0 bottom-0 z-20">
      {tabs.map(({ screen: tab, label, icon: Icon }) => {
        const isActive = current === tab
        return (
          <IonTabButton
            key={tab}
            data-tab={tab}
            data-tour={`tab-${tab}`}
            selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center gap-[3px] py-1 text-[10px] ${isActive ? 'font-extrabold text-ink' : 'font-semibold text-muted'}`}
          >
            <span className="nav-ic">
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
            </span>
            {label}
          </IonTabButton>
        )
      })}
    </IonTabBar>
    </div>
  )
}
