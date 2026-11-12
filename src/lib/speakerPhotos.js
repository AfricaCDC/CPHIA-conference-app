import { api, listOf } from './api'
import { usePhotoRefreshStore } from '../store/photoRefreshStore'

const SEEN_KEY = 'cphia-speaker-photo-urls'
const MAX_SEEN = 500
const MAX_PAGES = 20

/** Portrait URLs in the order the app should try them. */
export function speakerPhotoCandidates(speaker, { large = false } = {}) {
  if (!speaker) return []
  const preferred = large
    ? [speaker.photo_large_url, speaker.photo_url, speaker.external_photo_url]
    : [speaker.photo_thumb_url, speaker.photo_url, speaker.external_photo_url]
  return preferred.filter((url) => typeof url === 'string' && url !== '')
}

function readSeen() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((url) => typeof url === 'string') : []
  } catch {
    return []
  }
}

function writeSeen(urls) {
  const unique = [...new Set(urls)].slice(-MAX_SEEN)
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(unique))
  } catch {
    // A full storage quota must not block the portraits themselves.
  }
}

async function collectSpeakerPhotoUrls(slug) {
  const urls = []
  let page = 1
  let last = 1
  do {
    const payload = await api(`/events/${encodeURIComponent(slug)}/speakers?per_page=50&page=${page}`)
    for (const speaker of listOf(payload)) {
      const url = speakerPhotoCandidates(speaker)[0]
      if (url) urls.push(url)
    }
    last = payload.meta?.last_page ?? page
    page += 1
  } while (page <= last && page <= MAX_PAGES)
  return [...new Set(urls)]
}

/** Download pending portraits through the service worker so the image cache is the one <img> reads. */
function refreshThroughWorker(urls) {
  const worker = navigator.serviceWorker?.controller
  if (!worker) return null
  return new Promise((resolve) => {
    const saved = []
    let settled = false
    const finish = (ok) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      navigator.serviceWorker.removeEventListener('message', onMessage)
      resolve(ok ? saved : null)
    }
    // An older worker ignores this message. Give up and download from the page instead.
    let timer = setTimeout(() => finish(false), 1500)
    const onMessage = (event) => {
      const data = event.data ?? {}
      if (data.type === 'PHOTO_REFRESH_PROGRESS') {
        clearTimeout(timer)
        timer = setTimeout(() => finish(false), 20000)
        if (data.ok && data.url) saved.push(data.url)
        usePhotoRefreshStore.getState().setDone(data.done ?? 0)
      }
      if (data.type === 'PHOTO_REFRESH_DONE') finish(true)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    worker.postMessage({ type: 'REFRESH_IMAGES', urls })
  })
}

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
    image.src = url
  })
}

/** Reload one portrait. fetch updates a same-origin cache; an image tag still works across hosts. */
async function refreshOne(url) {
  try {
    const response = await fetch(url, { cache: 'reload' })
    if (response.ok || response.type === 'opaque') return true
  } catch {
    // A portrait on the admin host can be drawn without CORS. Fall through to the image tag.
  }
  return loadImage(url)
}

async function refreshDirect(urls) {
  const saved = []
  let done = 0
  let cursor = 0
  async function next() {
    while (cursor < urls.length) {
      const url = urls[cursor]
      cursor += 1
      if (await refreshOne(url)) saved.push(url)
      done += 1
      usePhotoRefreshStore.getState().setDone(done)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, next))
  return saved
}

let inFlight = null

/** On each app open, download speaker portraits that are new or have changed, and show progress. */
export function refreshSpeakerPhotos(slug) {
  if (inFlight) return inFlight
  inFlight = run(slug).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function run(slug) {
  const store = usePhotoRefreshStore.getState()
  if (!slug || store.active || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
  let urls = []
  try {
    urls = await collectSpeakerPhotoUrls(slug)
  } catch {
    return
  }
  const seen = new Set(readSeen())
  const pending = urls.filter((url) => !seen.has(url))
  if (pending.length === 0) return

  store.start(pending.length)
  try {
    const viaWorker = await refreshThroughWorker(pending)
    const missed = viaWorker ? pending.filter((url) => !viaWorker.includes(url)) : pending
    const savedDirect = missed.length > 0 ? await refreshDirect(missed) : []
    writeSeen([...seen, ...(viaWorker ?? []), ...savedDirect])
  } finally {
    usePhotoRefreshStore.getState().finish()
  }
}
