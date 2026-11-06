import Avatar from './ui/Avatar'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useAppStore } from '../store/appStore'

// Colour of the session's type, from the event theme.
const TYPE_COLOUR = {
  registration: ['rgb(var(--c-primary))', 'rgb(var(--c-tertiary))'],
  plenary: ['rgb(var(--c-destructive))', 'rgb(var(--c-destructive))'],
  keynote: ['rgb(var(--c-destructive))', 'rgb(var(--c-destructive))'],
  special_session: ['rgb(var(--c-destructive))', 'rgb(var(--c-destructive))'],
  session: ['rgb(var(--c-tertiary))', 'rgb(var(--c-tertiary))'],
  workshop: ['rgb(var(--c-tertiary))', 'rgb(var(--c-tertiary))'],
  networking: ['rgb(var(--c-secondary))', 'rgb(var(--c-ink))'],
  break: ['rgb(var(--c-primary))', 'rgb(var(--c-tertiary))'],
  other: ['rgb(var(--c-primary))', 'rgb(var(--c-tertiary))'],
}

export const typeLabel = (sessionOrType) => {
  if (sessionOrType && typeof sessionOrType === 'object') {
    return sessionOrType.programme_type_label
      || (sessionOrType.programme_type ? String(sessionOrType.programme_type).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Session')
  }
  return sessionOrType ? String(sessionOrType).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Session'
}
export const hhmm = (value) => value?.slice(0, 5) ?? ''
export const isBreak = (session) => session.programme_type === 'break'
export const hidesHall = (session) => session.programme_type === 'break' || session.programme_type === 'networking'
export const streamOf = (session) => session.streams?.youtube ?? session.streams?.zoom ?? null
export const roomOf = (session) => {
  if (hidesHall(session)) return ''
  return session.location_label
    || [session.hall?.name, session.venue?.name].filter(Boolean).join(' · ')
}

/** Speakers to preview on a list row (session speakers first, then any flat list). */
export function previewSpeakers(session, limit = 3) {
  const preferred = session.session_speakers?.length ? session.session_speakers : session.speakers
  return (preferred ?? []).slice(0, limit)
}

/**
 * A programme row: time, coloured type bar, title, room, speaker faces, and a save icon.
 */
export default function SessionCard({ session }) {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const saved = useAppStore((state) => state.schedule.includes(session.id))
  const toggleSession = useAppStore((state) => state.toggleSession)
  const showToast = useAppStore((state) => state.showToast)
  const [bar, text] = TYPE_COLOUR[session.programme_type] ?? TYPE_COLOUR.session
  const faces = previewSpeakers(session)
  const extra = Math.max(0, (session.session_speakers?.length || session.speakers?.length || 0) - faces.length)
  const tracks = (session.track_names?.length ? session.track_names : [session.track_name]).filter(Boolean)
  const trackLine = tracks.join(' · ')
  const metaLine = [
    roomOf(session),
    session.requires_separate_registration && 'Registration required',
  ].filter(Boolean).join(' · ')
  const placeLine = metaLine || (hidesHall(session) ? '' : 'Room to be confirmed')
  const open = () => navigateTo('session', { id: session.id })

  function toggle(event) {
    event.stopPropagation()
    toggleSession(session.id)
    showToast(saved ? 'Removed from my schedule' : 'Saved to my schedule')
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      className="flex cursor-pointer items-stretch gap-3 border-b border-line py-3.5 last:border-b-0 active:bg-mint-soft"
    >
      <div className="flex w-[52px] shrink-0 flex-col pt-0.5 text-right">
        <b className="text-[15px] tabular-nums">{hhmm(session.start_time)}</b>
        <span className="text-xs tabular-nums text-muted">{hhmm(session.end_time)}</span>
      </div>
      <span className="w-1 shrink-0 rounded-full" style={{ background: bar }} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[11px] font-extrabold uppercase tracking-[.6px]" style={{ color: text }}>
          {typeLabel(session)}{streamOf(session) ? ' · Live' : ''}
          {session.sub_sessions?.length ? ` · ${session.sub_sessions.length} parts` : ''}
        </span>
        <span className="text-[15px] font-bold leading-snug">{session.title}</span>
        {trackLine ? <span className="text-[13px] font-semibold leading-snug text-teal-dark">{trackLine}</span> : null}
        {placeLine ? <span className="text-[13px] text-muted">{placeLine}</span> : null}
        {faces.length > 0 && (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex -space-x-2">
              {faces.map((speaker) => (
                <Avatar
                  key={speaker.id ?? speaker.name}
                  name={speaker.name}
                  photoUrl={speaker.photo_thumb_url ?? speaker.photo_url}
                  size="sm"
                  className="ring-2 ring-cream"
                />
              ))}
            </div>
            <span className="min-w-0 truncate text-[12px] font-semibold text-ink/80">
              {faces.map((s) => s.name.split(' ').slice(-1)[0]).join(', ')}
              {extra > 0 ? ` +${extra}` : ''}
            </span>
          </div>
        )}
      </div>
      {!isBreak(session) && (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from my schedule' : 'Save to my schedule'}
          className={`grid size-11 shrink-0 place-items-center self-center rounded-full ${saved ? 'text-teal-dark' : 'text-muted'}`}
        >
          {saved ? <BookmarkCheck size={22} aria-hidden="true" /> : <Bookmark size={22} aria-hidden="true" />}
        </button>
      )}
    </div>
  )
}
