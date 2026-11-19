import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import {
  cameraErrorKind,
  cameraErrorMessage,
  cameraSupported,
  isNativePlatform,
  isStandaloneDisplay,
  logCameraDiagnostics,
  openCameraStream,
  stopCameraStream,
} from './camera'

const SCAN_INTERVAL_MS = 250
const MAX_SCAN_WIDTH = 480

/**
 * Reads QR codes from the camera. Chrome and Android use the built-in BarcodeDetector; every other browser,
 * including iPhone Safari, decodes the video frames in the page with jsQR.
 *
 * All permission handling lives in ./camera (native APK vs web / installed PWA). This hook owns the
 * lifecycle: one stream at a time, released on stop(), on unmount, and when a pending permission
 * request resolves after the user has already left the screen.
 *
 * Always call start() from a user gesture (button tap) so the browser shows its permission prompt.
 * Keep the <video> element laid out while requesting — sr-only / display:none makes Android Chrome
 * fail to play the stream.
 */
export function useBarcodeScanner(onDetected) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  // Bumped by every start() and stop(); a start() whose number is stale has been cancelled.
  const sessionRef = useRef(0)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected
  const [isScanning, setIsScanning] = useState(false)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [error, setError] = useState(null)
  const [errorKind, setErrorKind] = useState(null)
  const isSupported = cameraSupported()

  const release = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = null
    stopCameraStream(streamRef.current)
    streamRef.current = null
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
  }, [])

  const stop = useCallback(() => {
    sessionRef.current += 1
    release()
    setIsScanning(false)
    setIsRequestingPermission(false)
  }, [release])

  const start = useCallback(async () => {
    // Stop any previous session before opening a new one (Android can keep the last track busy).
    stop()
    const session = sessionRef.current
    setError(null)
    setErrorKind(null)
    // Show the coach at once; nothing is awaited before getUserMedia inside openCameraStream.
    setIsRequestingPermission(true)

    try {
      const stream = await openCameraStream()
      if (session !== sessionRef.current) {
        // Stopped, restarted or unmounted while the permission dialog was open.
        stopCameraStream(stream)
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        release()
        setError('Camera view is not ready. Try again.')
        setErrorKind('unknown')
        setIsRequestingPermission(false)
        return
      }
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      video.muted = true
      // iOS / some Android WebViews need play() after metadata is ready.
      if (video.readyState < 2) {
        await new Promise((resolve) => {
          const onReady = () => {
            video.removeEventListener('loadedmetadata', onReady)
            resolve()
          }
          video.addEventListener('loadedmetadata', onReady)
          setTimeout(resolve, 1500)
        })
      }
      await video.play().catch(() => {})
      if (session !== sessionRef.current) return
      setIsRequestingPermission(false)
      setIsScanning(true)

      const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null
      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'))
      const context = canvas.getContext('2d', { willReadFrequently: true })

      timerRef.current = setInterval(async () => {
        if (!video.videoWidth) return
        if (detector) {
          const [code] = await detector.detect(video).catch(() => [])
          if (code && session === sessionRef.current) onDetectedRef.current(code.rawValue)
          return
        }
        const scale = Math.min(1, MAX_SCAN_WIDTH / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
        const found = jsQR(data, width, height, { inversionAttempts: 'dontInvert' })
        if (found?.data) onDetectedRef.current(found.data)
      }, SCAN_INTERVAL_MS)
    } catch (err) {
      // Another request (a double tap) is already waiting on the permission dialog: leave it be.
      if (err?.busy) return
      logCameraDiagnostics(err)
      if (session !== sessionRef.current) return
      release()
      setIsScanning(false)
      setIsRequestingPermission(false)
      setError(cameraErrorMessage(err))
      setErrorKind(cameraErrorKind(err))
    }
  }, [release, stop])

  // Release the camera when the screen using this hook goes away.
  useEffect(() => () => {
    sessionRef.current += 1
    release()
  }, [release])

  // Only a refused site permission in an installed PWA is helped by reopening the page in a Chrome tab.
  const canOpenInBrowser = errorKind === 'denied' && !isNativePlatform() && isStandaloneDisplay()

  return { videoRef, isSupported, isScanning, isRequestingPermission, error, errorKind, canOpenInBrowser, start, stop }
}
