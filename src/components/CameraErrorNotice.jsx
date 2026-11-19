import { openAppInBrowserForCamera } from '../lib/camera'

/**
 * Camera failure message with its recovery actions, shared by every scanning screen.
 * `scanner` is the object returned by useBarcodeScanner.
 */
export default function CameraErrorNotice({ scanner, textClassName = 'text-maroon', onRetry }) {
  if (!scanner.error) return null
  return (
    <div role="alert" className="flex w-full flex-col gap-2">
      <p className={`text-sm font-bold ${textClassName}`}>{scanner.error}</p>
      <div className="flex flex-wrap gap-2">
        {/* A server-side block cannot be fixed by asking again. */}
        {scanner.errorKind !== 'policy-blocked' && (
          <button type="button" className="btn o sm" onClick={onRetry ?? scanner.start}>
            Retry camera
          </button>
        )}
        {scanner.canOpenInBrowser && (
          <button type="button" className="btn o sm" onClick={openAppInBrowserForCamera}>
            Open in Chrome
          </button>
        )}
      </div>
    </div>
  )
}
