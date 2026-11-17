import { Search, UserSearch } from 'lucide-react'
import Avatar from './Avatar'
import { HeaderIcon } from './ScreenHeader'
import { useAppStore } from '../../store/appStore'
import { useSessionStore } from '../../store/sessionStore'

/**
 * Top-right staff actions matching the delegate home: optional find, then profile avatar.
 */
export default function StaffHeaderActions({ find = true }) {
  const user = useSessionStore((state) => state.user)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const switchTab = useAppStore((state) => state.switchTab)

  return (
    <>
      {find && (
        <HeaderIcon
          icon={UserSearch}
          label="Find a person"
          onClick={() => switchTab('sfind')}
        />
      )}
      <button
        type="button"
        onClick={() => navigateTo('profile')}
        aria-label="My profile"
        className="rounded-full ring-2 ring-cream/40"
      >
        <Avatar name={user?.name} photoUrl={user?.photo_url} size="sm" className="!bg-cream !text-ink" />
      </button>
    </>
  )
}

/** Compact welcome strip under a staff desk header (profile lives in the top-right header only). */
export function StaffWelcome({ kicker = 'Signed in as', title }) {
  const user = useSessionStore((state) => state.user)
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{kicker}</span>
      <span className="truncate text-[17px] font-extrabold text-ink">{title || user?.name || 'Staff'}</span>
    </div>
  )
}

export function StaffSearchButton({ onClick, label = 'Search' }) {
  return <HeaderIcon icon={Search} label={label} onClick={onClick} />
}
