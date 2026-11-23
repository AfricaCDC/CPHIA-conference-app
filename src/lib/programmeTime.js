/** Conference wall clock for live / finished programme filters (Addis Ababa). */
export const PROGRAMME_TIMEZONE = 'Africa/Addis_Ababa'

function parseHmToMinutes(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** @returns {{ dateKey: string, minutes: number }} */
export function programmeWallClock(now = new Date(), timeZone = PROGRAMME_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour') || 0) * 60 + Number(get('minute') || 0),
  }
}

/** @returns {'upcoming'|'ongoing'|'finished'} */
export function sessionTimeStatus(session, now = new Date(), timeZone = PROGRAMME_TIMEZONE) {
  const key = String(session?.date || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return 'upcoming'
  const start = parseHmToMinutes(session?.start_time)
  const end = parseHmToMinutes(session?.end_time)
  if (start == null || end == null) return 'upcoming'

  const clock = programmeWallClock(now, timeZone)
  if (key < clock.dateKey) return 'finished'
  if (key > clock.dateKey) return 'upcoming'
  if (clock.minutes < start) return 'upcoming'
  if (clock.minutes >= end) return 'finished'
  return 'ongoing'
}

export function matchesProgrammeSearch(session, query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return true
  const people = [
    ...(session.speakers ?? []),
    ...(session.moderators ?? []),
    ...(session.session_people ?? []),
    ...(session.session_speakers ?? []),
    ...(session.presenters ?? []),
  ]
  const hay = [
    session.title,
    session.description,
    session.programme_type_label,
    session.programme_type,
    session.track_name,
    ...(session.track_names ?? []),
    session.location_label,
    session.hall?.name,
    session.venue?.name,
    session.organizer_name,
    ...people.flatMap((p) => [p.name, p.title, p.organization, p.role_label]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(needle)
}
