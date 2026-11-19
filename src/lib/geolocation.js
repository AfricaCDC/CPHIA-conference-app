/**
 * Geolocation helpers for Android Chrome PWA + iOS Safari.
 *
 * Call only from a user gesture (button tap) so the system Allow dialog appears.
 * Android Chrome drops the gesture if we await Permissions.query / paint first —
 * call getCurrentPosition as the first async work (same pattern as camera).
 */

import { isStandaloneDisplay } from './camera'

export function geolocationSupported() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation
}

/**
 * Best-effort read. Do not gate getCurrentPosition on this — Chrome can misreport.
 *
 * @returns {Promise<'granted'|'denied'|'prompt'|'unknown'>}
 */
export async function queryGeolocationPermission() {
  if (!navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    const state = status?.state
    if (state === 'granted' || state === 'denied' || state === 'prompt') return state
  } catch {
    // Unsupported name on some browsers
  }
  return 'unknown'
}

export function geolocationErrorMessage(err) {
  const code = err?.code
  if (code === 1 || code === err?.PERMISSION_DENIED) {
    if (isStandaloneDisplay()) {
      return 'Location was not allowed. Tap again and choose Allow (look near the top of the screen on installed Android apps). If it never appears: App info → Permissions → Location → Allow, or open this site once in Chrome → Allow location, then return here.'
    }
    return 'Location permission was not granted. Tap again and choose Allow. If you blocked it earlier: Chrome lock/tune icon → Site settings → Location → Allow (or App info → Permissions → Location).'
  }
  if (code === 2 || code === err?.POSITION_UNAVAILABLE) {
    return 'Location is unavailable right now. Move near a window or enter coordinates manually.'
  }
  if (code === 3 || code === err?.TIMEOUT) {
    return 'Location timed out. Try again outdoors, or enter coordinates manually.'
  }
  return 'Could not read your location. Allow location when prompted, or enter it manually.'
}

/**
 * @param {PositionOptions} [options]
 * @returns {Promise<GeolocationPosition>}
 */
function getPositionOnce(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

/**
 * Read the current position. First call must be getCurrentPosition (preserve user gesture).
 *
 * @returns {Promise<{ latitude: number, longitude: number, accuracy: number|null }>}
 */
export async function readCurrentPosition() {
  if (!geolocationSupported()) {
    const err = new Error('Location is not available on this device')
    err.code = 2
    throw err
  }

  // Fast network/coarse fix first — more likely to prompt + succeed indoors.
  // Do not await anything before this call.
  try {
    const pos = await getPositionOnce({
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 60000,
    })
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
    }
  } catch (err) {
    if (err?.code === 1 || err?.code === err?.PERMISSION_DENIED) {
      throw err
    }
  }

  const pos = await getPositionOnce({
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  })
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
  }
}
