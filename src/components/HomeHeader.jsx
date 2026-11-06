import BrandLogo from './BrandLogo'
import { dateRange, eventStatus } from '../lib/event'
import { useEventSlug } from '../lib/useParticipant'
import { useRemote } from '../lib/useRemote'

/** The brand header used on the home screens: logo, actions on the right, and the event's place, dates and status. */
export default function HomeHeader({ right = null }) {
  const slug = useEventSlug()
  const info = useRemote(`/events/${encodeURIComponent(slug)}`).data?.data
  const status = eventStatus(info?.start_date, info?.end_date)

  return (
    <>
      <header className="brand-header sticky top-0 z-20 flex items-center justify-between gap-3 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+10px)] text-cream">
        <BrandLogo className="h-14 -my-3" />
        <div className="flex items-center gap-2">{right}</div>
      </header>
      <div className="-mt-2 flex items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 flex-col">
          <span className="text-[14px] font-bold">{info?.location ?? 'Addis Ababa, Ethiopia'}</span>
          <span className="text-[13px] text-muted">{dateRange(info?.start_date, info?.end_date) ?? '23–27 Nov 2026'}</span>
        </div>
        {status && (
          <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-extrabold ${status.live ? 'bg-tertiary text-cream' : 'bg-secondary text-ink'}`}>
            {status.live && <span className="size-1.5 animate-pulse rounded-full bg-secondary" aria-hidden="true" />}
            {status.label}
          </span>
        )}
      </div>
    </>
  )
}

/** A round action in the header (search, bell, avatar), with an optional count. */
export function HeaderButton({ label, onClick, count = 0, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={count ? `${label}, ${count} to do` : label} className="relative grid size-11 place-items-center rounded-full bg-white/15">
      {children}
      {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-maroon px-1 text-[10px] font-extrabold text-cream">{count > 9 ? '9+' : count}</span>}
    </button>
  )
}
