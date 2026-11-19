/**
 * Camera helpers for badge QR scanning on Android Chrome PWA + Capacitor + iOS Safari.
 *
 * Permission: unlock with a plain `{ video: true }` first when needed (Android often
 * skips the Allow dialog if facingMode is on the first call).
 *
 * Lens: always open the rear / environment camera for badge scanning. applyConstraints
 * cannot switch front→back on iOS (or most Androids) — stop the unlock stream and
 * request a new one with facingMode / deviceId.
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
      // fall through
    }
  }
  if (!navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'camera' })
    const state = status?.state
    if (state === 'granted' || state === 'denied' || state === 'prompt') return state
  } catch {
    // unsupported name
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

function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => {
    try {
      track.stop()
    } catch {
      // ignore
    }
  })
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Let the permission coach paint before the OS/browser Allow UI appears. */
function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTimeout(resolve, 80))
    })
  })
}

function isBackCameraLabel(label) {
  const text = String(label || '').toLowerCase()
  if (!text) return false
  if (/front|user|face|selfie|facing\s*front/.test(text)) return false
  return /back|rear|environment|trás|arrière|hinter|후면|后置|背面/.test(text)
}

function isFrontCameraLabel(label) {
  const text = String(label || '').toLowerCase()
  return /front|user|face|selfie|facing\s*front|전면|前置/.test(text)
}

/**
 * Pick the rear camera deviceId after permission has been granted (labels are then available).
 * @returns {Promise<string|null>}
 */
async function findRearCameraDeviceId() {
  if (!navigator.mediaDevices?.enumerateDevices) return null
  const devices = await navigator.mediaDevices.enumerateDevices()
  const videos = devices.filter((device) => device.kind === 'videoinput' && device.deviceId)
  if (!videos.length) return null

  const byLabel = videos.find((device) => isBackCameraLabel(device.label))
  if (byLabel) return byLabel.deviceId

  // Prefer a non-front labelled camera when labels exist.
  const nonFront = videos.find((device) => device.label && !isFrontCameraLabel(device.label))
  if (nonFront) return nonFront.deviceId

  // Many phones list front first, rear last when labels are empty (iOS before/without labels).
  if (videos.length > 1) return videos[videos.length - 1].deviceId
  return videos[0].deviceId
}

/**
 * Open the rear / environment camera. Call only after camera permission is granted.
 * @returns {Promise<MediaStream>}
 */
async function openRearCameraStream() {
  const attempts = [
    { video: { facingMode: { exact: 'environment' } }, audio: false },
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
  ]

  let lastError = null
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastError = err
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        throw err
      }
    }
  }

  const deviceId = await findRearCameraDeviceId()
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      })
    } catch (err) {
      lastError = err
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { ideal: deviceId } },
          audio: false,
        })
      } catch (retryErr) {
        lastError = retryErr
      }
    }
  }

  // Last resort — any camera (better than failing the scan entirely).
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  } catch (err) {
    throw lastError || err
  }
}

/**
 * Unlock camera permission without locking onto the front camera for scanning.
 * Android: first getUserMedia must often be unconstrained so the Allow dialog appears.
 * iOS/Android after grant: open a fresh rear-camera stream (do not rely on applyConstraints).
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

  const permissionState = await queryCameraPermission()
  const alreadyGranted = permissionState === 'granted' || native === 'granted'

  // If permission is not yet granted, unlock with a plain request (shows Android Allow),
  // then release and open the rear camera. iOS also defaults plain video to the front lens.
  if (!alreadyGranted) {
    let unlock = null
    try {
      unlock = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        throw err
      }
      unlock = await navigator.mediaDevices.getUserMedia({ video: {}, audio: false })
    }
    stopStream(unlock)
    // iOS needs a beat after stopping before another getUserMedia succeeds.
    await wait(150)
  }

  return openRearCameraStream()
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
    stopStream(stream)
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
