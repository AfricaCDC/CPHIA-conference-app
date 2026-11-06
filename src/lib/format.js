import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'

export function formatRelative(isoDate) {
  return formatDistanceToNowStrict(parseISO(isoDate), { addSuffix: true })
}

export function formatDateTime(isoDate) {
  return format(parseISO(isoDate), 'd MMM yyyy, HH:mm')
}

export function formatDayLong(isoDay) {
  return format(parseISO(isoDay), 'EEEE d MMMM')
}
