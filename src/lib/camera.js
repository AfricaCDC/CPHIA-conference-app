/**
 * Camera helpers for badge QR scanning on Android Chrome PWA + iOS Safari.
 *
 * Android Chrome often fails to show the system permission dialog when the first
 * getUserMedia call uses facingMode constraints. Request a plain `{ video: true }`
 * first (same pattern as Notification.requestPermission), then optionally prefer
 * the rear camera via applyConstraints — never a second getUserMedia for permission.
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
    return 'Camera permission was not granted. Tap “Start scanning” again and choose Allow. If you previously blocked it: Chrome lock/tune icon → Site settings → Camera → Allow (or App info → Permissions → Camera).'
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

/**
 * Open a camera stream. Always unlock permission with a simple video constraint
 * first so Android shows the system Allow dialog (like notifications).
 *
 * @returns {Promise<MediaStream>}
 */
export async function openCameraStream() {
  if (!cameraSupported()) {
    const err = new Error('Camera needs a secure (https) page.')
    err.name = 'SecurityError'
    throw err
  }

  // Plain request — triggers the Android/iOS permission dialog.
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  } catch (err) {
    // One more attempt with explicit empty video object (some WebViews differ).
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
