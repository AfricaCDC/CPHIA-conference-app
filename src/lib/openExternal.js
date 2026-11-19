/** Official conference schedule (Teninete) — opens outside the app. */
export const SCHEDULE_EXTERNAL_URL = 'https://www.teninete.et/'

/**
 * Open a URL in the system / browser tab (not an in-app screen).
 * Capacitor Browser plugin when present; otherwise a new browser tab.
 */
export function openExternal(url) {
  const href = String(url || '').trim()
  if (!href) return false

  try {
    const Browser = window.Capacitor?.Plugins?.Browser
    if (Browser?.open) {
      Browser.open({ url: href })
      return true
    }
  } catch {
    // Fall through to window.open.
  }

  const opened = window.open(href, '_blank', 'noopener,noreferrer')
  if (opened) return true

  // Popup blocked — navigate this tab as a last resort.
  window.location.assign(href)
  return true
}
