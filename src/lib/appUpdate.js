import { useAppStore } from '../store/appStore'

const CHECK_EVERY_MS = 5 * 60 * 1000
const RELOAD_FLAG = 'cphia-pwa-reloaded-for-update'
const APPLIED_FLAG = 'cphia-pwa-update-applied'

function basePath() {
  return (import.meta.env.BASE_URL || '/app/').replace(/\/?$/, '/')
}

/** The hashed entry script currently driving this page (e.g. assets/index-Ab12.js). */
function currentEntryScript() {
  const scripts = [...document.querySelectorAll('script[src]')]
  const hit = scripts.map((el) => el.getAttribute('src') || '').find((src) => /\/assets\/index-[^/]+\.js(?:\?|$)/.test(src))
  if (!hit) return null
  const match = hit.match(/assets\/index-[^/]+\.js/)
  return match ? match[0] : null
}

/** Pull the entry script name from a fresh copy of the app shell HTML. */
function entryScriptFromHtml(html) {
  const match = html.match(/assets\/index-[^"'\\\s]+\.js/)
  return match ? match[0] : null
}

function markReload(buildId) {
  try {
    sessionStorage.setItem(RELOAD_FLAG, buildId)
    sessionStorage.setItem(APPLIED_FLAG, '1')
  } catch {
    /* private mode */
  }
}

function alreadyReloadedFor(buildId) {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === buildId
  } catch {
    return false
  }
}

function consumeAppliedToast() {
  try {
    if (sessionStorage.getItem(APPLIED_FLAG) !== '1') return
    sessionStorage.removeItem(APPLIED_FLAG)
    useAppStore.getState().showToast('App updated', 'info')
  } catch {
    /* ignore */
  }
}

function applyUpdate(buildId) {
  if (!buildId || alreadyReloadedFor(buildId)) return
  markReload(buildId)
  try {
    useAppStore.getState().showToast('Updating the app…', 'info')
  } catch {
    /* store may not be ready */
  }
  // Give the toast a beat to paint, then load the new shell and hashed bundles.
  window.setTimeout(() => {
    window.location.reload()
  }, 600)
}

/**
 * Ask the browser for a new service worker, and compare the live index.html
 * entry script to the one this tab is running. When either shows a newer build,
 * reload so delegates pick up code without reinstalling the PWA.
 */
export async function checkForAppUpdate(registration) {
  if (typeof window === 'undefined') return
  if (window.Capacitor?.isNativePlatform?.()) return

  try {
    await registration?.update?.()
  } catch {
    /* offline or mid-update */
  }

  const current = currentEntryScript()
  if (!current) return

  try {
    const response = await fetch(`${basePath()}index.html`, {
      cache: 'no-store',
      headers: { Accept: 'text/html' },
    })
    if (!response.ok) return
    const remote = entryScriptFromHtml(await response.text())
    if (remote && remote !== current) applyUpdate(remote)
  } catch {
    /* offline */
  }
}

/**
 * Background updater: polls for new builds, checks again when the tab is shown
 * or the device comes online, and reloads once a newer service worker takes over.
 */
export function startAppUpdater(registration) {
  if (typeof window === 'undefined') return () => {}
  if (window.Capacitor?.isNativePlatform?.()) return () => {}

  consumeAppliedToast()

  let timer = null
  // Only treat controllerchange as an update when this tab was already controlled.
  // First install also claims the page; reloading then would bounce every new visitor.
  const hadControllerOnStart = Boolean(navigator.serviceWorker.controller)

  const run = () => {
    checkForAppUpdate(registration).catch(() => {})
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') run()
  }

  // A waiting worker (older builds without skipWaiting) should activate immediately.
  const onUpdateFound = () => {
    const worker = registration?.installing
    if (!worker) return
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        worker.postMessage({ type: 'SKIP_WAITING' })
      }
    })
  }

  const onControllerChange = () => {
    if (!hadControllerOnStart) return
    // New SW claimed this page — reload once so in-memory modules match the new shell.
    const id = currentEntryScript() || `sw-${Date.now()}`
    applyUpdate(id)
  }

  run()
  timer = window.setInterval(run, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', run)
  window.addEventListener('online', run)
  registration?.addEventListener?.('updatefound', onUpdateFound)
  navigator.serviceWorker?.addEventListener?.('controllerchange', onControllerChange)

  return () => {
    if (timer) window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', run)
    window.removeEventListener('online', run)
    registration?.removeEventListener?.('updatefound', onUpdateFound)
    navigator.serviceWorker?.removeEventListener?.('controllerchange', onControllerChange)
  }
}
