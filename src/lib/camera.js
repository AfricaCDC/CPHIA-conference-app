/**
 * Camera helpers for badge QR scanning on Android Chrome PWA + Capacitor + iOS Safari.
 *
 * Why notifications prompt but camera often does not (Chrome installed PWA):
 * - Push uses Notification.requestPermission() → Android shows a real centered system dialog.
 * - Camera uses getUserMedia() → Chrome frequently auto-denies or shows a tiny top-edge chip
 *   that is easy to miss; after one miss the origin is blocked with no dialog next time.
 *
 * Capacitor APK path: request the native Android CAMERA permission first (same dialog style
 * as other app permissions), then call getUserMedia so the WebView grant succeeds.
 */

import { Capacitor } from '@capacitor/core'

export function isNativePlatform() {
  try {
    return Boolean(Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  if (isNativePlatform()) return true
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true
  )
}

export function cameraSupported() {
  return (
    typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && (typeof window === 'undefined' || window.isSecureContext || isNativePlatform())
  )
}

/**
 * Ask Android/iOS for CAMERA the same way other native permissions work.
 * No-op on plain web / Chrome PWA.
 *
 * @returns {Promise<'granted'|'denied'|'prompt'|'unavailable'>}
 */
export async function ensureNativeCameraPermission() {
  if (!isNativePlatform()) return 'prompt'
  try {
    const { Camera } = await import('@capacitor/camera')
    const current = await Camera.checkPermissions()
    if (current?.camera === 'granted') return 'granted'
    const next = await Camera.requestPermissions({ permissions: ['camera'] })
    if (next?.camera === 'granted') return 'granted'
    if (next?.camera === 'denied') return 'denied'
    return 'prompt'
  } catch {
    // Plugin missing or WebView will still try getUserMedia via BridgeWebChromeClient.
    return 'unavailable'
  }
}

/**
 * @returns {Promise<'granted'|'denied'|'prompt'|'unknown'>}
 */
export async function queryCameraPermission() {
  if (isNativePlatform()) {
    try {
      const { Camera } = await import('@capacitor/camera')
      const status = await Camera.checkPermissions()
      const state = status?.camera
      if (state === 'granted' || state === 'denied' || state === 'prompt') return state
      if (state === 'prompt-with-rationale') return 'prompt'
    } catch {
      // fall through to Permissions API
    }
  }
  if (!navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'camera' })
    const state = status?.state
    if (state === 'granted' || state === 'denied' || state === 'prompt') return state
  } catch {
    // Firefox / some WebViews reject name: 'camera'
  }
  return 'unknown'
}

export function cameraErrorMessage(err, { permissionState } = {}) {
  const name = err?.name || ''
  const denied = name === 'NotAllowedError' || name === 'PermissionDeniedError' || permissionState === 'denied'
  if (denied) {
    if (isNativePlatform()) {
      return 'Camera was not allowed. Tap again and choose Allow on the system dialog. If you blocked it: phone Settings → Apps → CPHIA → Permissions → Camera → Allow.'
    }
    if (isStandaloneDisplay()) {
      return 'Camera was blocked for this installed app. Chrome does not show the same Allow dialog for camera as it does for notifications. Fix: open this site once in Chrome (not the installed app) → Allow camera, then return here — or install the Android APK. Or: App info → Permissions → Camera → Allow.'
    }
    return 'Camera permission was not granted. Tap again and choose Allow. If you previously blocked it: Chrome lock/tune icon → Site settings → Camera → Allow.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device. Enter the badge ID instead.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is in use by another app. Close it, then try again.'
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'This device could not open the rear camera. Try again, or enter the badge ID.'
  }
  if (name === 'SecurityError') {
    return 'Camera needs a secure (https) page. Enter the badge ID instead.'
  }
  return 'Camera unavailable. Allow camera access when prompted, or enter the badge ID.'
}

/**
 * Prefer the rear camera without a second permission round-trip.
 * @param {MediaStream} stream
 */
async function preferRearCamera(stream) {
  const track = stream.getVideoTracks?.()?.[0]
  if (!track?.applyConstraints) return stream
  try {
    await track.applyConstraints({ facingMode: { ideal: 'environment' } })
  } catch {
    // Keep the stream we already have — front camera is fine for scanning.
  }
  return stream
}

/** Let the permission coach paint before the OS/browser Allow UI appears. */
function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTimeout(resolve, 80))
    })
  })
}

/**
 * Open a camera stream.
 *
 * @returns {Promise<MediaStream>}
 */
export async function openCameraStream() {
  if (!cameraSupported()) {
    const err = new Error('Camera needs a secure (https) page.')
    err.name = 'SecurityError'
    throw err
  }

  await waitForPaint()

  const native = await ensureNativeCameraPermission()
  if (native === 'denied') {
    const err = new Error('Camera permission denied')
    err.name = 'NotAllowedError'
    throw err
  }

  // Plain request — triggers browser Allow UI (or WebView grant after native Allow).
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      throw err
    }
    stream = await navigator.mediaDevices.getUserMedia({ video: {}, audio: false })
  }

  return preferRearCamera(stream)
}

/**
 * Request camera once (user gesture), then release tracks.
 *
 * @returns {Promise<'granted'|'denied'|'unavailable'>}
 */
export async function primeCameraAccess() {
  if (!cameraSupported()) return 'unavailable'
  try {
    const stream = await openCameraStream()
    stream.getTracks().forEach((track) => track.stop())
    return 'granted'
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      return 'denied'
    }
    return 'unavailable'
  }
}

/** Open the current app URL in Chrome so the browser camera Allow prompt can appear. */
export function openAppInBrowserForCamera() {
  if (typeof window === 'undefined') return
  if (isNativePlatform()) {
    // Native: send user to Android app settings for Camera.
    try {
      const { NativeSettings, AndroidSettings } = window.Capacitor?.Plugins || {}
      if (NativeSettings?.openAndroid) {
        NativeSettings.openAndroid({ option: AndroidSettings?.ApplicationDetails || 'application_details' })
        return
      }
    } catch {
      // fall through
    }
  }
  const url = new URL(window.location.href)
  url.searchParams.set('primeCamera', '1')
  const withoutScheme = url.toString().replace(/^https?:\/\//i, '')
  window.location.href = `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`
}
