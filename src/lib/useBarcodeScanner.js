import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

const SCAN_INTERVAL_MS = 250
const MAX_SCAN_WIDTH = 480

/**
 * Reads QR codes from the camera. Chrome and Android use the built-in BarcodeDetector; every other browser,
 * including iPhone Safari, decodes the video frames in the page with jsQR. The camera needs a secure page (https).
 */
export function useBarcodeScanner(onDetected) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState(null)
  const hasCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const isSupported = hasCamera && (typeof window === 'undefined' || window.isSecureContext)

  const stop = useCallback(() => {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setIsScanning(false)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!isSupported) {
      setError('The camera needs a secure (https) page. Enter the badge ID instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      const video = videoRef.current
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      await video.play()
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
        // Decode the current frame in the page (jsQR), at a size that keeps phones responsive.
        const scale = Math.min(1, MAX_SCAN_WIDTH / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
        const found = jsQR(data, width, height, { inversionAttempts: 'dontInvert' })
        if (found?.data) onDetected(found.data)
      }, SCAN_INTERVAL_MS)
    } catch {
      setError('Camera unavailable. Allow camera access in your browser settings, or enter the badge ID.')
      stop()
    }
  }, [isSupported, onDetected, stop])

  useEffect(() => stop, [stop])

  return { videoRef, isSupported, isScanning, error, start, stop }
}
