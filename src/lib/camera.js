/**
 * Camera helpers for badge QR scanning on Android Chrome PWA + iOS Safari.
 *
 * Android often fails silently when facingMode is required (not ideal), or when
 * camera was previously denied for the installed PWA origin. We soften
 * constraints, map error names, and expose a one-tap “prime” for install onboarding.
 */

export function cameraSupported() {
  return (
    typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && (typeof window === 'undefined' || window.isSecureContext)
  )
}

/**
 * @returns {Promise<'granted'|'denied'|'prompt'|'unknown'>}
 */
export async function queryCameraPermission() {
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

export function cameraErrorMessage(err) {
  const name = err?.name || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera is blocked for this app. On Android Chrome: tap the lock/tune icon next to the address → Site settings → Camera → Allow, then try again. Or open App info → Permissions → Camera.'
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
  return 'Camera unavailable. Allow camera access in your browser settings, or enter the badge ID.'
}

/**
 * Open a camera stream with Android-friendly fallbacks.
 * Prefer rear camera when available; never hard-require facingMode.
 *
 * @returns {Promise<MediaStream>}
 */
export async function openCameraStream() {
  if (!cameraSupported()) {
    const err = new Error('Camera needs a secure (https) page.')
    err.name = 'SecurityError'
    throw err
  }

  const attempts = [
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
    { video: true, audio: false },
  ]

  let lastError = null
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastError = err
      // Permission denied will not succeed on a softer constraint — stop early.
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        throw err
      }
    }
  }
  throw lastError ?? new Error('Camera unavailable')
}

/**
 * Request camera once (user gesture), then release tracks.
 * Used after install so Android shows the system prompt before Scan is opened.
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
