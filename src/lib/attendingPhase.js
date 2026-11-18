/** CPHIA 2026 defaults when the event API has not loaded dates yet. */
export const DEFAULT_EVENT_START = '2026-11-23'
export const DEFAULT_EVENT_END = '2026-11-27'

/**
 * Conference share-graphic phase from the event calendar (inclusive local dates).
 * before → “I will be Attending”; during → “I am Attending”; after → “I Attended”.
 */
export function attendingPhase(startDate, endDate, now = new Date()) {
  const start = String(startDate || DEFAULT_EVENT_START).slice(0, 10)
  const end = String(endDate || DEFAULT_EVENT_END).slice(0, 10)
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  if (today < start) return 'before'
  if (today > end) return 'after'
  return 'during'
}

export const ATTENDING_COPY = {
  before: {
    phrase: 'I will be Attending',
    lines: ['I will be', 'Attending'],
    title: 'I will be Attending',
    cardTitle: 'I will be Attending',
    intro: 'Create your share graphic for CPHIA 2026. Download or share it with #AfricaReady and #CPHIA2026.',
    actionTitle: 'Create your “I will be Attending” graphic',
    actionSubtitle: 'Add your photo, download and share',
    shareText: 'I will be attending CPHIA 2026 in Addis Ababa. #AfricaReady #CPHIA2026',
    filename: 'CPHIA2026-I-will-be-attending.png',
    preview: 'Live preview of your I will be Attending graphic',
  },
  during: {
    phrase: 'I am Attending',
    lines: ['I am', 'Attending'],
    title: 'I am Attending',
    cardTitle: 'I am Attending',
    intro: 'Show that you are at CPHIA 2026. Download or share your graphic with #AfricaReady and #CPHIA2026.',
    actionTitle: 'Create your “I am Attending” graphic',
    actionSubtitle: 'Add your photo, download and share',
    shareText: 'I am attending CPHIA 2026 in Addis Ababa. #AfricaReady #CPHIA2026',
    filename: 'CPHIA2026-I-am-attending.png',
    preview: 'Live preview of your I am Attending graphic',
  },
  after: {
    phrase: 'I Attended',
    lines: ['I', 'Attended'],
    title: 'I Attended',
    cardTitle: 'I Attended',
    intro: 'Share that you attended CPHIA 2026. Download or post your graphic with #AfricaReady and #CPHIA2026.',
    actionTitle: 'Create your “I Attended” graphic',
    actionSubtitle: 'Add your photo, download and share',
    shareText: 'I attended CPHIA 2026 in Addis Ababa. #AfricaReady #CPHIA2026',
    filename: 'CPHIA2026-I-attended.png',
    preview: 'Live preview of your I Attended graphic',
  },
}

export function attendingCopy(startDate, endDate, now = new Date()) {
  return ATTENDING_COPY[attendingPhase(startDate, endDate, now)]
}
