/**
 * Camera helpers for badge QR scanning on Android Chrome PWA + Capacitor + iOS Safari.
 *
 * Android Chrome (especially installed / standalone PWAs) is strict: getUserMedia must run
 * inside the same user-gesture turn as the tap. Awaiting paint / Permissions.query first
 * often yields NotAllowedError with NO Allow dialog. APKs use Capacitor Camera permissions
 * instead; iOS Safari is more forgiving — which is why those paths worked while Chrome PWA failed.
 *
 * Flow: call a plain { video: true } getUserMedia immediately → then (permission already
 * granted) open a fresh rear / environment stream for scanning.
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
 * Ask Android/iOS for CAMERA via Capacitor. No-op on plain web / Chrome PWA.
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
 * Best-effort Permissions API read. Do NOT treat "denied" as fatal before getUserMedia —
 * Chrome on Android often lies or is unsupported for name:"camera".
 *
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
      return 'Camera was not allowed. Tap Start scanning again and choose Allow (look near the top of the screen). If Chrome blocked it earlier: App info → Permissions → Camera → Allow, or open this site once in Chrome → Allow camera, then return here.'
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

  const nonFront = videos.find((device) => device.label && !isFrontCameraLabel(device.label))
  if (nonFront) return nonFront.deviceId

  if (videos.length > 1) return videos[videos.length - 1].deviceId
  return videos[0].deviceId
}

/**
 * Open the rear / environment camera. Safe to call after permission is already granted
 * (second getUserMedia does not need a fresh user gesture).
 * @returns {Promise<MediaStream>}
 */
async function openRearCameraStream() {
  const attempts = [
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
        // Permission revoked mid-flow — bubble up.
        throw err
      }
    }
  }

  const deviceId = await findRearCameraDeviceId()
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { ideal: deviceId } },
        audio: false,
      })
    } catch (err) {
      lastError = err
    }
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  } catch (err) {
    throw lastError || err
  }
}

/**
 * Unlock + open camera. Call from a user gesture (button tap).
 *
 * Web/PWA: first line of async work must be getUserMedia — no paint waits, no Permissions.query.
 * Native: Capacitor Camera permission first, then getUserMedia.
 *
 * @returns {Promise<MediaStream>}
 */
export async function openCameraStream() {
  if (!cameraSupported()) {
    const err = new Error('Camera needs a secure (https) page.')
    err.name = 'SecurityError'
    throw err
  }

  // APK / Capacitor: system permission dialog (same family as notifications).
  if (isNativePlatform()) {
    const native = await ensureNativeCameraPermission()
    if (native === 'denied') {
      const err = new Error('Camera permission denied')
      err.name = 'NotAllowedError'
      throw err
    }
    return openRearCameraStream()
  }

  // Chrome PWA / Safari: getUserMedia FIRST while the tap gesture is still live.
  let unlock = null
  try {
    unlock = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      throw err
    }
    try {
      unlock = await navigator.mediaDevices.getUserMedia({ video: {}, audio: false })
    } catch (retryErr) {
      throw retryErr
    }
  }

  // Prefer rear camera for badge scanning. Permission is already granted, so this
  // second call does not need the original user gesture.
  stopStream(unlock)
  await wait(80)
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

/** Open the current app URL in Chrome so site settings / Allow can be fixed. */
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
