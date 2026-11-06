/** Where the conference is today: days to go, happening now, or ended. */
export function eventStatus(startIso, endIso) {
  if (!startIso) return null
  const today = new Date(new Date().toDateString())
  const start = new Date(`${startIso}T00:00:00`)
  const end = new Date(`${endIso ?? startIso}T23:59:59`)
  if (today < start) return { label: `${Math.round((start - today) / 86400000)} days to go`, live: false }
  if (today <= end) return { label: 'Event in progress', live: true }
  return { label: 'Event has ended', live: false }
}

export function dateRange(start, end) {
  if (!start) return null
  const f = (d, o) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', o)
  return end && end !== start ? `${f(start, { day: 'numeric' })}–${f(end, { day: 'numeric', month: 'short' })}` : f(start, { day: 'numeric', month: 'short' })
}
