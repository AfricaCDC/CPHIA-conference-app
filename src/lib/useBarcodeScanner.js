import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { cameraErrorMessage, cameraSupported, openCameraStream, queryCameraPermission } from './camera'

const SCAN_INTERVAL_MS = 250
const MAX_SCAN_WIDTH = 480

/**
 * Reads QR codes from the camera. Chrome and Android use the built-in BarcodeDetector; every other browser,
 * including iPhone Safari, decodes the video frames in the page with jsQR. The camera needs a secure page (https).
 *
 * Always call start() from a user gesture (button tap) so Android Chrome shows the permission prompt.
 * Keep the <video> element visible in the layout while requesting — sr-only / display:none causes
 * Android Chrome to deny getUserMedia without a dialog.
 *
 * Do not await paint / Permissions.query before getUserMedia on Android Chrome PWA — that drops the
 * user gesture and yields NotAllowedError with no Allow chip (APK + iOS still worked).
 */
export function useBarcodeScanner(onDetected) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [error, setError] = useState(null)
  const isSupported = cameraSupported()

  const stop = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
    setIsScanning(false)
    setIsRequestingPermission(false)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!isSupported) {
      setError('The camera needs a secure (https) page. Enter the badge ID instead.')
      return
    }
    // Stop any previous session before opening a new one (Android can keep the last track busy).
    stop()
    // Show coach immediately; do not await a paint frame before getUserMedia.
    setIsRequestingPermission(true)

    try {
      // First await must be getUserMedia (inside openCameraStream) while the tap gesture is live.
      const stream = await openCameraStream()
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        setError('Camera view is not ready. Try again.')
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
      setIsRequestingPermission(false)
      setIsScanning(true)

      const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null
      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'))
      const context = canvas.getContext('2d', { willReadFrequently: true })

      timerRef.current = setInterval(async () => {
        if (!video.videoWidth) return
        if (detector) {
          const [code] = await detector.detect(video).catch(() => [])
          if (code) onDetected(code.rawValue)
          return
        }
        const scale = Math.min(1, MAX_SCAN_WIDTH / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
        const found = jsQR(data, width, height, { inversionAttempts: 'dontInvert' })
        if (found?.data) onDetected(found.data)
      }, SCAN_INTERVAL_MS)
    } catch (err) {
      const permissionState = await queryCameraPermission().catch(() => 'unknown')
      setError(cameraErrorMessage(err, { permissionState }))
      stop()
    }
  }, [isSupported, onDetected, stop])

  useEffect(() => stop, [stop])

  return { videoRef, isSupported, isScanning, isRequestingPermission, error, start, stop }
}
