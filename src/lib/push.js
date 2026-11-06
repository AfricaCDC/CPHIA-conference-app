import { api } from './api'

const SW_SCRIPT = `${import.meta.env.BASE_URL}sw.js`
/** Scope `/app` (no trailing slash) covers both `/app` and `/app/…` on the public site. */
const SW_SCOPE = '/app'

function urlBase64ToUint8Array(base64) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Public Next.js serves the PWA at `/app` (no trailing slash). A worker whose
 * default scope is `/app/` never controls that page, so `serviceWorker.ready`
 * hangs forever. Align the URL and register with scope `/app`.
 */
export function alignAppPathForServiceWorker() {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/app') {
    window.history.replaceState(null, '', `/app/${window.location.search}${window.location.hash}`)
  }
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** iPhone/iPad only allow web push once the PWA is added to the home screen. */
export function needsHomeScreenInstall() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  return isIos && !standalone
}

async function waitUntilActive(registration) {
  if (registration.active) return registration

  const worker = registration.installing || registration.waiting
  if (!worker) {
    return withTimeout(
      navigator.serviceWorker.ready.then(() => registration),
      12000,
      'Notifications could not start. Refresh the page and try again.',
    )
  }

  await withTimeout(
    new Promise((resolve) => {
      if (registration.active) {
        resolve()
        return
      }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated' || registration.active) resolve()
      })
    }),
    12000,
    'Notifications could not start. Refresh the page and try again.',
  )
  return registration
}

/** Register (or reuse) the app service worker. Used for offline shell and for push. */
export async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('This browser does not support the app service worker.')
  }

  alignAppPathForServiceWorker()

  const registration = await withTimeout(
    navigator.serviceWorker.register(SW_SCRIPT, { scope: SW_SCOPE }),
    12000,
    'Could not prepare notifications on this device. Refresh and try again.',
  )
  return waitUntilActive(registration)
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const registration = (await navigator.serviceWorker.getRegistration(SW_SCOPE))
    ?? (await navigator.serviceWorker.getRegistration())
  return registration ? registration.pushManager.getSubscription() : null
}

export async function enablePush(eventSlug) {
  if (!pushSupported()) {
    throw new Error(
      needsHomeScreenInstall()
        ? 'On iPhone, add this app to your Home Screen first, then open it from there.'
        : 'This browser does not support push notifications.',
    )
  }

  const config = await api('/push/config')
  if (!config.web_push_enabled) throw new Error('Push notifications are not set up on the server yet.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings.')

  const registration = await ensureServiceWorker()
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
      }),
      20000,
      'Could not finish turning on notifications. Check your connection and try again.',
    ))

  await api('/participant/push-device', {
    method: 'POST',
    body: { platform: 'web', subscription: subscription.toJSON(), event_slug: eventSlug },
  })
}

export async function disablePush() {
  const subscription = await currentSubscription()
  if (!subscription) return
  await api('/participant/push-device', { method: 'DELETE', body: { endpoint: subscription.endpoint } }).catch(() => {})
  await subscription.unsubscribe()
}
