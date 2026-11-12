import Card from '../../components/ui/Card'
import Avatar from '../../components/ui/Avatar'
import ListRow from '../../components/ui/ListRow'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { hhmm, hidesHall, isBreak, roomOf, streamOf, typeLabel } from '../../components/SessionCard'
import { formatDayLong } from '../../lib/format'
import { useProgramme } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

function PersonList({ title, people, onOpen }) {
  if (!people?.length) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="h3">{title}</h2>
      <Card className="card !gap-0 overflow-hidden p-0">
        {people.map((person) => (
          <ListRow key={`${title}-${person.id ?? person.name}`} onClick={() => onOpen?.(person)}>
            <Avatar name={person.name} photoUrl={person.photo_thumb_url ?? person.photo_url} size="md" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="t">{person.name}</span>
              <span className="s">
                {[person.role_label, person.title, person.organization].filter(Boolean).join(' · ') || 'Tap for profile'}
              </span>
            </span>
          </ListRow>
        ))}
      </Card>
    </section>
  )
}

function SubSessionBlock({ sub, onOpenSpeaker }) {
  const people = [...(sub.moderators ?? []), ...(sub.speakers ?? [])]
  return (
    <Card className="card gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {sub.label && <span className="text-[11px] font-extrabold uppercase tracking-[.6px] text-tertiary">{sub.label}</span>}
            <h3 className="text-[15px] font-extrabold leading-snug">{sub.title}</h3>
          </div>
          {(sub.start_time || sub.end_time || sub.duration_minutes) && (
            <span className="shrink-0 rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-ink">
              {sub.start_time && sub.end_time
                ? `${hhmm(sub.start_time)}–${hhmm(sub.end_time)}`
                : sub.duration_minutes
                  ? `${sub.duration_minutes} min`
                  : hhmm(sub.start_time)}
            </span>
          )}
        </div>
        {sub.description && <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted">{sub.description}</p>}
      </div>
      {people.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {people.map((person) => (
            <button
              key={`${sub.id}-${person.id ?? person.name}`}
              type="button"
              onClick={() => onOpenSpeaker?.(person)}
              className="flex items-center gap-3 text-left"
            >
              <Avatar name={person.name} photoUrl={person.photo_thumb_url ?? person.photo_url} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-extrabold">{person.name}</span>
                <span className="truncate text-[11px] text-muted">
                  {[person.role_label, person.organization || person.title].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

/** One session: room, description, moderators, speakers and timed sub-sessions. */
export default function SessionScreen({ params }) {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const saved = useAppStore((state) => state.schedule.includes(params.id))
  const toggleSession = useAppStore((state) => state.toggleSession)
  const showToast = useAppStore((state) => state.showToast)
  const { sessions, loading, error, reload } = useProgramme()
  const session = sessions.find((s) => String(s.id) === String(params.id))
  const hall = session?.venue?.halls?.find((h) => h.id === session.hall?.id) ?? session?.hall
  const point = hall?.latitude != null ? hall : session?.venue
  const stream = session && streamOf(session)
  const tracks = (session?.track_names?.length ? session.track_names : [session?.track_name]).filter(Boolean)
  const openSpeaker = () => navigateTo('speakers')

  function toggle() {
    toggleSession(params.id)
    showToast(saved ? 'Removed from my schedule' : 'Added to my schedule')
  }

  return (
    <>
      <ScreenHeader
        kicker={session ? `${typeLabel(session)} · ${formatDayLong(session.date)}` : 'Session'}
        title={session?.title ?? 'Session'}
        subtitle={tracks.length ? tracks.join(' · ') : null}
        tone="maroon"
        back
      >
        {session && (
          <div className="flex gap-2">
            <button type="button" className="btn y sm flex-1" onClick={toggle}>{saved ? '★ In my schedule' : '+ Add to my schedule'}</button>
            {stream && <a className="btn sm bg-maroon" href={stream} target="_blank" rel="noopener noreferrer">▶ Live</a>}
          </div>
        )}
      </ScreenHeader>
      <Body>
        <LoadState loading={loading && !session} error={error} onRetry={reload}>
          {!session ? (
            <div className="empty">This session is no longer in the programme.</div>
          ) : (
            <div className="flex flex-col gap-5">
              <Card className="card row">
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  {roomOf(session) ? (
                    <span className="t">{roomOf(session)}</span>
                  ) : !hidesHall(session) ? (
                    <span className="t">Room to be confirmed</span>
                  ) : null}
                  <span className="s">
                    {formatDayLong(session.date)} · {hhmm(session.start_time)}–{hhmm(session.end_time)}
                    {session.duration_minutes ? ` · ${session.duration_minutes} min` : ''}
                  </span>
                  {!hidesHall(session) && (
                    <button
                      type="button"
                      className="inline-flex w-fit items-center gap-1 text-xs font-bold text-maroon"
                      onClick={() => navigateTo('directions', {
                        kicker: 'Session room',
                        title: roomOf(session) || 'Session room',
                        latitude: point?.latitude ?? null,
                        longitude: point?.longitude ?? null,
                        notes: hall?.directions_notes ?? session.venue?.directions_notes ?? null,
                        floorPlanUrl: session.venue?.floor_plan_url ?? null,
                      })}
                    >
                      Directions to the room
                    </button>
                  )}
                </div>
              </Card>

              {session.requires_separate_registration && (
                <Card className="card yellow">
                  <span className="t">Registration required</span>
                  <span className="s">Seats are limited{session.capacity ? ` to ${session.capacity}` : ''}. Your badge QR is checked at the door.</span>
                </Card>
              )}

              {session.programme_type === 'side_event' && session.organizer_name ? (
                <Card className="card">
                  <span className="s">Organised by</span>
                  <span className="t">{session.organizer_name}</span>
                </Card>
              ) : null}

              {session.description && (
                <section className="flex flex-col gap-2">
                  <h2 className="h3">About</h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed">{session.description}</p>
                </section>
              )}

              {session.session_people?.length ? (
                <PersonList title="Session people" people={session.session_people} onOpen={openSpeaker} />
              ) : (
                <>
                  <PersonList title="Moderators" people={session.moderators} onOpen={openSpeaker} />
                  <PersonList
                    title={session.presenters?.length && !session.session_speakers?.length ? 'Presenters' : 'Speakers'}
                    people={
                      session.session_speakers?.length
                        ? session.session_speakers
                        : (session.presenters?.length ? session.presenters : session.speakers)
                    }
                    onOpen={openSpeaker}
                  />
                </>
              )}

              {session.sub_sessions?.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="h3">In this session</h2>
                  {session.sub_sessions.map((sub) => (
                    <SubSessionBlock key={sub.id} sub={sub} onOpenSpeaker={openSpeaker} />
                  ))}
                </section>
              )}
            </div>
          )}
        </LoadState>
      </Body>
    </>
  )
}
