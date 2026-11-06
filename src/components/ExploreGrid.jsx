import { Bell, Bus, CalendarCheck, CalendarDays, Building2, IdCard, Lock, MapPin, Megaphone, MessageCircle, Mic2, Plane, BedDouble, Users, Wallet, FileText, ScrollText, ListChecks, LayoutGrid } from 'lucide-react'
import { useAppStore } from '../store/appStore'

// Every section of the app. Public ones open for everyone; the others ask for sign-in first.
export const SECTIONS = [
  { screen: 'programme', label: 'Programme', icon: CalendarDays, personal: false },
  { screen: 'speakers', label: 'Speakers', icon: Mic2, personal: false },
  { screen: 'venues', label: 'Venue', icon: MapPin, personal: false },
  { screen: 'partners', label: 'Partners', icon: Building2, personal: false },
  { screen: 'announcements', label: 'News', icon: Megaphone, personal: false },
  { screen: 'badge', label: 'My badge', icon: IdCard, personal: true },
  { screen: 'schedule', label: 'My schedule', icon: CalendarCheck, personal: true },
  { screen: 'travel', label: 'Ticket', icon: Plane, personal: true },
  { screen: 'accommodation', label: 'Hotel', icon: BedDouble, personal: true },
  { screen: 'transport', label: 'Transport', icon: Bus, personal: true },
  { screen: 'messages', label: 'Messages', icon: MessageCircle, personal: true },
  { screen: 'connect', label: 'Connect', icon: Users, personal: true },
  { screen: 'finance', label: 'Finance', icon: Wallet, personal: true },
  { screen: 'documents', label: 'Documents', icon: FileText, personal: true },
  { screen: 'visa', label: 'Visa', icon: ScrollText, personal: true },
  { screen: 'journey', label: 'My journey', icon: ListChecks, personal: true },
]

/** The sections as a grid of up to three rows of four. Personal ones show a lock for guests and a bell when they need action. */
// The sections that get their own tile. Everything else opens from All, and All carries their bells.
const VISIBLE = ['accommodation', 'programme', 'speakers', 'venues', 'announcements', 'badge', 'schedule', 'travel', 'transport', 'finance', 'messages']

export default function ExploreGrid({ signedIn, counts = {} }) {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const tiles = SECTIONS.filter((section) => VISIBLE.includes(section.screen))
  const hiddenDue = Object.entries(counts).filter(([screen]) => !VISIBLE.includes(screen)).reduce((sum, [, n]) => sum + n, 0)

  return (
    <nav aria-label="Explore the conference" className="grid grid-cols-4 gap-2">
      {tiles.map(({ screen, label, icon: Icon, personal }) => {
        const locked = personal && !signedIn
        const due = counts[screen] ?? 0
        return (
          <button key={screen} type="button" onClick={() => navigateTo(screen)} className="lift relative flex flex-col items-center gap-1.5 rounded-xl bg-white px-1 py-2.5 transition active:scale-[.96]">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/25 text-tertiary">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="text-center text-[11px] font-semibold leading-tight">{label}</span>
            {locked && <Lock size={10} className="absolute right-1.5 top-1.5 text-muted" aria-label="Sign in to open" />}
            {due > 0 && (
              <span className="absolute -right-1 -top-1 flex items-center gap-0.5 rounded-full bg-maroon px-1.5 py-0.5 text-[10px] font-extrabold text-cream shadow" aria-label={`${due} to do`}>
                <Bell size={9} aria-hidden="true" />{due}
              </span>
            )}
          </button>
        )
      })}
      <button type="button" onClick={() => navigateTo('more')} className="lift relative flex flex-col items-center gap-1.5 rounded-xl bg-white px-1 py-2.5 transition active:scale-[.96]">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/25 text-tertiary"><LayoutGrid size={20} aria-hidden="true" /></span>
        <span className="text-center text-[11px] font-semibold leading-tight">All</span>
        {hiddenDue > 0 && (
          <span className="absolute -right-1 -top-1 flex items-center gap-0.5 rounded-full bg-maroon px-1.5 py-0.5 text-[10px] font-extrabold text-cream shadow" aria-label={`${hiddenDue} to do`}>
            <Bell size={9} aria-hidden="true" />{hiddenDue}
          </span>
        )}
      </button>
    </nav>
  )
}
