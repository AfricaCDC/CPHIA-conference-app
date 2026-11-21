import { needsHomeScreenInstall } from './push'

/** True when running inside a Capacitor APK / native shell (not the browser PWA). */
export function isNativeApp() {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

/** True when the page is already running from the home-screen / installed PWA. */
export function isRunningAsInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || navigator.standalone === true
}

export function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isAndroidDevice() {
  return /android/i.test(navigator.userAgent)
}

/**
 * Whether we should still nudge the user to install (banner / More).
 * PWA / browser only — never show install chrome inside the native APK.
 */
export function shouldOfferInstall() {
  if (typeof window === 'undefined') return false
  if (isNativeApp()) return false
  if (isRunningAsInstalledApp()) return false
  return true
}

export { needsHomeScreenInstall }
