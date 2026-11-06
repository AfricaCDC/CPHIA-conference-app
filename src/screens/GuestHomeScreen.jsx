import { LogIn, Search, Megaphone, UserPlus } from 'lucide-react'
import SessionCard from '../components/SessionCard'
import ExploreGrid from '../components/ExploreGrid'
import InstallBanner from '../components/InstallBanner'
import HomeHeader, { HeaderButton } from '../components/HomeHeader'
import { LoadState } from '../components/ui/LoadState'
import { listOf } from '../lib/api'
import { useEventSlug, useProgramme } from '../lib/useParticipant'
import { useRemote } from '../lib/useRemote'
import { useAppStore } from '../store/appStore'
import { REGISTRATION_URL } from '../data/participant'
import { useSessionStore } from '../store/sessionStore'

/** Public home: the header, the explore grid (personal sections lock until sign-in), the programme and news. */
export default function GuestHomeScreen() {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const signedIn = useSessionStore((state) => Boolean(state.token))
  const slug = useEventSlug()
  const { sessions, loading, error, reload } = useProgramme()
  const news = useRemote(`/events/${encodeURIComponent(slug)}/announcements`)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = sessions.filter((s) => s.date >= today).slice(0, 3)
  const next = upcoming.length ? upcoming : sessions.slice(0, 3)
  const items = listOf(news.data).slice(0, 4)

  return (
    <div className="flex flex-col gap-6 pb-6">
      <HomeHeader right={<HeaderButton label="Search the conference" onClick={() => navigateTo('search')}><Search size={20} aria-hidden="true" /></HeaderButton>} />

      <InstallBanner />

      {!signedIn && (
        <section className="lift mx-4 flex items-center gap-3 rounded-2xl bg-white p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/25 text-tertiary"><UserPlus size={18} aria-hidden="true" /></span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-bold">Not registered yet?</span>
            <span className="text-[12px] text-muted">Register for CPHIA 2026 first</span>
          </div>
          <a href={REGISTRATION_URL} target="_blank" rel="noopener noreferrer" className="h-9 rounded-full border border-tertiary px-4 text-[14px] font-bold leading-9 text-tertiary">Register</a>
        </section>
      )}

      {!signedIn && (
        <section className="lift mx-4 flex items-center gap-3 rounded-2xl bg-white p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-ink"><LogIn size={18} aria-hidden="true" /></span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-bold">Sign in</span>
            <span className="text-[12px] text-muted">For your badge, schedule and travel</span>
          </div>
          <button type="button" onClick={() => navigateTo('signin')} className="h-9 rounded-full bg-tertiary px-4 text-[14px] font-bold text-cream">Sign in</button>
        </section>
      )}

      <section className="flex flex-col gap-3 px-4">
        <h2 className="text-[17px] font-extrabold">Explore</h2>
        <ExploreGrid signedIn={signedIn} />
      </section>

      <section className="flex flex-col gap-2 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold">Programme</h2>
          <button type="button" className="text-[14px] font-bold text-tertiary" onClick={() => navigateTo('programme')}>See all</button>
        </div>
        <LoadState loading={loading && !sessions.length} error={error} onRetry={reload}>
          {next.length === 0 && <div className="empty">The programme has not been published yet.</div>}
          {next.length > 0 && <div className="flex flex-col">{next.map((session) => <SessionCard key={session.id} session={session} />)}</div>}
        </LoadState>
      </section>

      {items.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-[17px] font-extrabold">News</h2>
            <button type="button" className="text-[14px] font-bold text-tertiary" onClick={() => navigateTo('announcements')}>All news</button>
          </div>
          <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => navigateTo('announcements')} className="lift w-[260px] shrink-0 snap-start rounded-2xl bg-white p-4 text-left">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-tertiary"><Megaphone size={12} aria-hidden="true" />News</span>
                <span className="mt-1 block text-[15px] font-extrabold leading-snug">{item.title}</span>
                <span className="mt-1 line-clamp-2 block text-[13px] text-muted">{item.body}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
