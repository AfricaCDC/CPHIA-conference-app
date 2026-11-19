/**
 * Central camera service for QR / badge scanning.
 *
 * Two separate permission systems are in play, chosen with Capacitor (never the user agent):
 *
 *  - Native APK / iOS app (Capacitor.isNativePlatform()): the OS permission, requested through
 *    the @capacitor/camera plugin, then getUserMedia inside the WebView.
 *  - Web / installed Chrome PWA: Chrome's per-site permission, requested by getUserMedia itself.
 *    An installed PWA has no Android permissions of its own ("No permissions allowed" under
 *    Android Settings → Apps is normal) — it uses Chrome's site permission for its origin.
 *
 * On the web, a response header `Permissions-Policy: camera=()` switches the camera off for the
 * whole page: getUserMedia then rejects with NotAllowedError straight away and Chrome never shows
 * the Allow dialog. That looks exactly like a user denial, so it is detected separately here
 * (cameraPolicyAllowed) and reported as its own error kind.
 */

import { Capacitor } from '@capacitor/core'

export function isNativePlatform() {
  try {
    return Boolean(Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

function platformName() {
  try {
    return Capacitor?.getPlatform?.() || 'web'
  } catch {
    return 'web'
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
 * Whether the page's Permissions-Policy lets this document use the camera at all.
 *
 * @returns {boolean|null} false = switched off by the server (or an embedding iframe);
 *   null = the browser cannot tell us (Safari, Firefox).
 */
export function cameraPolicyAllowed() {
  if (typeof document === 'undefined' || isNativePlatform()) return null
  try {
    const policy = document.permissionsPolicy || document.featurePolicy
    if (typeof policy?.allowsFeature === 'function') return Boolean(policy.allowsFeature('camera'))
  } catch {
    // not supported
  }
  return null
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

function cameraError(name, message, extra = {}) {
  const err = new Error(message)
  err.name = name
  return Object.assign(err, extra)
}

/**
 * Sort a camera failure into one cause, so each gets its own message and recovery steps.
 *
 * @returns {'policy-blocked'|'denied'|'not-found'|'in-use'|'overconstrained'|'insecure'|'unsupported'|'unknown'}
 */
export function cameraErrorKind(err) {
  const name = err?.name || ''
  if (err?.policyBlocked) return 'policy-blocked'
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return cameraPolicyAllowed() === false ? 'policy-blocked' : 'denied'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'not-found'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'in-use'
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'overconstrained'
  if (name === 'SecurityError') return 'insecure'
  if (name === 'TypeError') return 'unsupported'
  return 'unknown'
}

/** User-facing text for a camera failure. `permissionState` is accepted for older callers and ignored. */
export function cameraErrorMessage(err) {
  const kind = cameraErrorKind(err)
  if (kind === 'policy-blocked') {
    return 'The camera is switched off for this web address by the server, so your browser cannot ask for permission. Nothing on your phone needs changing — please report this to the CPHIA support team and enter the badge ID instead.'
  }
  if (kind === 'denied') {
    if (isNativePlatform()) {
      return 'Camera was not allowed. Tap again and choose Allow on the system dialog. If you blocked it: phone Settings → Apps → CPHIA → Permissions → Camera → Allow.'
    }
    const site = typeof window !== 'undefined' ? window.location.host : 'this site'
    return `Camera access is required to scan participant badges. Please enable Camera permission in Chrome Site Settings, return to this application, and try again. In Chrome: menu (⋮) → Settings → Site settings → Camera → ${site} → Allow. If ${site} is not listed there, open All sites → ${site} → Clear & reset, then try again and choose Allow. Chrome itself also needs the camera: phone Settings → Apps → Chrome → Permissions → Camera.`
  }
  if (kind === 'not-found') {
    return 'No camera was found on this device. Enter the badge ID instead.'
  }
  if (kind === 'in-use') {
    return 'The camera could not be started. It may be in use by another app — close other camera apps, then try again.'
  }
  if (kind === 'overconstrained') {
    return 'This device could not open a suitable camera. Try again, or enter the badge ID.'
  }
  if (kind === 'insecure') {
    return 'The camera only works on a secure (https) page. Open the app from its https address, or enter the badge ID.'
  }
  if (kind === 'unsupported') {
    return 'This browser cannot open the camera here. Open the app in Chrome, or enter the badge ID.'
  }
  return 'The camera could not be started. Try again, or enter the badge ID.'
}

/**
 * Console diagnostics for a camera failure. Never logs scanned QR contents or participant data.
 */
export async function logCameraDiagnostics(err) {
  const info = {
    platform: platformName(),
    native: isNativePlatform(),
    installedPwa: !isNativePlatform() && isStandaloneDisplay(),
    secureContext: typeof window !== 'undefined' ? window.isSecureContext : null,
    mediaDevices: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
    getUserMedia: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    permissionsPolicyAllowsCamera: cameraPolicyAllowed(),
    inIframe: typeof window !== 'undefined' ? window.self !== window.top : null,
    permissionState: 'unknown',
    videoInputs: null,
    errorKind: cameraErrorKind(err),
    errorName: err?.name || null,
    errorMessage: err?.message || null,
    constraint: err?.constraint || null,
  }
  try {
    info.permissionState = await queryCameraPermission()
  } catch {
    // keep 'unknown'
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    info.videoInputs = devices.filter((device) => device.kind === 'videoinput').length
  } catch {
    // not accessible
  }
  console.warn('[camera] could not start', info)
  return info
}

export function stopCameraStream(stream) {
  stream?.getTracks?.().forEach((track) => {
    try {
      track.stop()
    } catch {
      // ignore
    }
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

  const nonFront = videos.find((device) => device.label && !isFrontCameraLabel(device.label))
  if (nonFront) return nonFront.deviceId

  if (videos.length > 1) return videos[videos.length - 1].deviceId
  return videos[0].deviceId
}

/**
 * Open the rear camera, preferring `facingMode: { ideal: 'environment' }` (never `exact`, which
 * fails outright on devices that do not label their cameras), then falling back to any camera.
 * The first getUserMedia call here is what makes the browser show its permission prompt.
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
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError') {
        // Asking again with other constraints cannot change a refusal.
        throw err
      }
    }
  }

  const deviceId = await findRearCameraDeviceId().catch(() => null)
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

async function requestCameraStream() {
  if (isNativePlatform()) {
    // APK / iOS app: OS permission through the Capacitor Camera plugin, then the WebView camera.
    if (!navigator.mediaDevices?.getUserMedia) {
      throw cameraError('TypeError', 'Camera API is not available in this WebView.')
    }
    const native = await ensureNativeCameraPermission()
    if (native === 'denied') {
      throw cameraError('NotAllowedError', 'Camera permission denied')
    }
    return openRearCameraStream()
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw cameraError('SecurityError', 'Camera needs a secure (https) page.')
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw cameraError('TypeError', 'Camera API is not available in this browser.')
  }
  if (cameraPolicyAllowed() === false) {
    throw cameraError('NotAllowedError', 'Camera is disabled by the Permissions-Policy of this page.', { policyBlocked: true })
  }
  // Nothing is awaited before getUserMedia, so the call stays inside the tap that started it.
  return openRearCameraStream()
}

let pendingRequest = null

/**
 * Ask for the camera and open the rear one. Call from a user gesture (button tap).
 * Only one request runs at a time: a second call while the first is waiting on the permission
 * dialog rejects with `busy: true` and must be ignored by the caller.
 *
 * The caller owns the returned stream and must stop its tracks (stopCameraStream).
 *
 * @returns {Promise<MediaStream>}
 */
export function openCameraStream() {
  if (pendingRequest) {
    return Promise.reject(cameraError('AbortError', 'A camera request is already in progress.', { busy: true }))
  }
  pendingRequest = requestCameraStream().finally(() => {
    pendingRequest = null
  })
  return pendingRequest
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
    stopCameraStream(stream)
    return 'granted'
  } catch (err) {
    if (err?.busy) return 'unavailable'
    logCameraDiagnostics(err)
    return cameraErrorKind(err) === 'denied' ? 'denied' : 'unavailable'
  }
}

/**
 * Leave the installed PWA and open the same address in a Chrome tab, where the address-bar
 * icon gives direct access to this site's camera setting. Android Chrome only; there is no
 * link a web page can use to open Chrome's site settings directly.
 */
export function openAppInBrowserForCamera() {
  if (typeof window === 'undefined' || isNativePlatform()) return
  const withoutScheme = window.location.href.replace(/^https?:\/\//i, '')
  window.location.href = `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`
}
