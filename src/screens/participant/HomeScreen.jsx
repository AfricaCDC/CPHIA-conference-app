import { Bell, ChevronRight, MessageCircle, Search } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import BadgeQr from '../../components/BadgeQr'
import PushCard from '../../components/PushCard'
import SessionCard from '../../components/SessionCard'
import ExploreGrid from '../../components/ExploreGrid'
import InstallBanner from '../../components/InstallBanner'
import HomeHeader, { HeaderButton } from '../../components/HomeHeader'
import { useActionCenter, useProgramme } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'
import { useSessionStore } from '../../store/sessionStore'

/** The signed-in home: the same header and explore grid as guests, plus the badge, what needs the delegate, and the next session. */
export default function HomeScreen() {
  const user = useSessionStore((state) => state.user)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const schedule = useAppStore((state) => state.schedule)
  const { items, counts, registration } = useActionCenter()
  const { sessions } = useProgramme()
  const today = new Date().toISOString().slice(0, 10)
  const next = sessions.filter((s) => schedule.includes(s.id) && s.date >= today)[0] ?? null
  const category = [registration?.category_name, registration?.journey?.title].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-6 pb-6">
      <HomeHeader
        right={
          <>
            <HeaderButton label="Search the conference" onClick={() => navigateTo('search')}><Search size={20} aria-hidden="true" /></HeaderButton>
            <HeaderButton label="Action center" count={items.length} onClick={() => navigateTo('actions')}><Bell size={20} aria-hidden="true" /></HeaderButton>
            <button type="button" onClick={() => navigateTo('profile')} aria-label="My profile" data-tour="profile" className="rounded-full">
              <Avatar name={user?.name} photoUrl={user?.photo_url} size="md" className="ring-2 ring-cream/50" />
            </button>
          </>
        }
      />

      <section className="flex flex-col gap-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-col">
            <span className="text-[12px] font-bold uppercase tracking-wide text-muted">Welcome back</span>
            <span className="truncate text-[20px] font-extrabold">{user?.name ?? 'Delegate'}</span>
          </div>
        </div>

        {registration?.badge_qr_payload && (
          <button type="button" onClick={() => navigateTo('badge')} data-tour="badge-card" className="lift flex items-center gap-4 rounded-2xl bg-white p-4 text-left">
            <BadgeQr value={registration.badge_qr_payload} size={56} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary">My badge</span>
              <span className="truncate text-[16px] font-extrabold">{category || 'Delegate'}</span>
              <span className="text-[12px] text-muted">Tap to show your QR at the desk</span>
            </span>
            <ChevronRight size={18} className="shrink-0 opacity-60" aria-hidden="true" />
          </button>
        )}

        <button type="button" onClick={() => navigateTo('actions')} className="lift flex items-center gap-3 rounded-2xl bg-white p-4 text-left" data-tour="needs">
          <span className={`grid size-11 shrink-0 place-items-center rounded-full ${items.length ? 'bg-maroon text-cream' : 'bg-primary/25 text-tertiary'}`}>
            <Bell size={20} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[16px] font-extrabold">Action center</span>
            <span className="text-[13px] text-muted">{items.length ? `${items.length} thing${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} you` : 'You are all caught up'}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </section>

      <section className="flex flex-col gap-3 px-4">
        <h2 className="text-[17px] font-extrabold">Explore</h2>
        <ExploreGrid signedIn counts={counts} />
      </section>

      <div className="px-4">
        <InstallBanner />
      </div>

      {next && (
        <section className="flex flex-col gap-2 px-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-extrabold">Next on my schedule</h2>
            <button type="button" className="text-[14px] font-bold text-tertiary" onClick={() => navigateTo('schedule')}>See all</button>
          </div>
          <SessionCard session={next} />
        </section>
      )}

      <div className="px-4">
        <button type="button" onClick={() => navigateTo('messages')} className="lift flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/25 text-tertiary"><MessageCircle size={18} aria-hidden="true" /></span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-bold">Messages</span>
            <span className="text-[12px] text-muted">Chats, updates and the Travel & Finance desks</span>
          </span>
          <ChevronRight size={18} className="shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </div>

      <div className="px-4">
        <PushCard />
      </div>
    </div>
  )
}
