/* CPHIA 2026 service worker: offline app shell, cached assets, push and background sync. */

// Build id below is stamped at vite build time so every deploy changes this file and browsers fetch the new worker.
const VERSION = 'v11-__BUILD_ID__'
const SHELL_CACHE = `cphia-shell-${VERSION}`
const RUNTIME_CACHE = `cphia-runtime-${VERSION}`
// Photos and floor plans get their own cache, trimmed to the most recent entries so it cannot grow without limit.
const IMAGE_CACHE = `cphia-images-${VERSION}`
const IMAGE_LIMIT = 200
// Paths are relative to the service worker, which lives at /app/sw.js.
const SHELL_URLS = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// App tab can ask a waiting worker to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// Pages: network first so updates arrive, cached shell when offline.
async function handleNavigation(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(SHELL_CACHE)
    cache.put('./index.html', response.clone())
    return response
  } catch {
    return (await caches.match('./index.html')) ?? Response.error()
  }
}

// Hashed build assets, icons and fonts never change under the same URL: cache first.
/**
 * Photos, floor plans and the logo, from any host: show the saved copy at once and refresh it in the
 * background, so a screen never waits on a photo it has already seen.
 */
async function handleImage(request, event) {
  const cache = await caches.open(IMAGE_CACHE)
  const cached = await cache.match(request)
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === 'opaque') {
        await cache.put(request, response.clone())
        await trimCache(cache, IMAGE_LIMIT)
      }
      return response
    })
    .catch(() => cached)

  if (cached) {
    event.waitUntil(refresh)
    return cached
  }
  return refresh
}

async function trimCache(cache, limit) {
  const keys = await cache.keys()
  if (keys.length <= limit) return
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)))
}

async function handleAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Images first: resized photos come from the API's media endpoint, and they are safe to cache.
  if (request.destination === 'image') {
    event.respondWith(handleImage(request, event))
    return
  }

  // Other API calls always go to the network; the app keeps its own offline copies.
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  const isSameOriginAsset = url.origin === self.location.origin
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (isSameOriginAsset || isFont) event.respondWith(handleAsset(request))
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'CPHIA 2026', {
      body: data.body ?? 'You have a new update.',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: data.tag ?? undefined,
      data: { url: data.url ?? './' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url ?? './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((client) => 'focus' in client)
      if (!open) return self.clients.openWindow(target)
      // Reload the open app on the screen the notification is about (/app/?screen=badge).
      const client = 'navigate' in open ? await open.navigate(target) : open
      return (client ?? open).focus()
    }),
  )
})

// Background sync: wake open app tabs so they can flush offline staff actions / message drafts.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'sync-messages' && event.tag !== 'sync-staff-actions') return
  event.waitUntil(
    self.clients.matchAll().then((clients) => clients.forEach((client) => client.postMessage({ type: event.tag }))),
  )
})
