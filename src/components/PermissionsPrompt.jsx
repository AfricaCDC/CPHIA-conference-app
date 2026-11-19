import { useEffect, useState } from 'react'
import { Camera, BellRing, ShieldCheck, X } from 'lucide-react'
import { cameraSupported, primeCameraAccess, queryCameraPermission } from '../lib/camera'
import {
  currentSubscription,
  enablePush,
  needsHomeScreenInstall,
  pushSupported,
} from '../lib/push'
import { useEventSlug } from '../lib/useParticipant'
import { useAppStore } from '../store/appStore'
import { usePermissionsPromptStore } from '../store/permissionsPromptStore'
import { useRoles } from '../lib/roles'

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true
  )
}

/**
 * Asks the user to allow camera (and notifications when useful) after install /
 * when opening the installed PWA — especially important on Android where Chrome
 * does not re-prompt once camera was denied for the origin.
 */
export default function PermissionsPrompt() {
  const eventSlug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const tourOpen = useAppStore((state) => state.tourOpen)
  const { canScan } = useRoles()
  const dismissed = usePermissionsPromptStore((state) => state.dismissed)
  const completed = usePermissionsPromptStore((state) => state.completed)
  const needsSetup = usePermissionsPromptStore((state) => state.needsSetup)
  const dismiss = usePermissionsPromptStore((state) => state.dismiss)
  const complete = usePermissionsPromptStore((state) => state.complete)
  const requestSetup = usePermissionsPromptStore((state) => state.requestSetup)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [cameraState, setCameraState] = useState('unknown')
  const [pushOn, setPushOn] = useState(null)

  useEffect(() => {
    // First open as installed PWA → nudge permissions once.
    if (isStandaloneDisplay() && !completed && !dismissed) {
      requestSetup()
    }
  }, [completed, dismissed, requestSetup])

  useEffect(() => {
    let cancelled = false
    queryCameraPermission().then((state) => {
      if (!cancelled) setCameraState(state)
    })
    currentSubscription()
      .then((subscription) => {
        if (!cancelled) setPushOn(Boolean(subscription))
      })
      .catch(() => {
        if (!cancelled) setPushOn(false)
      })
    return () => {
      cancelled = true
    }
  }, [needsSetup])

  const wantsCamera = cameraSupported() && (canScan || isStandaloneDisplay())
  const wantsPush = pushSupported() && !needsHomeScreenInstall() && pushOn === false

  useEffect(() => {
    if (!needsSetup || completed || dismissed) return
    if (!wantsCamera && pushOn !== false) {
      complete()
      return
    }
    if (cameraState === 'granted' && !wantsPush) {
      complete()
    }
  }, [needsSetup, completed, dismissed, wantsCamera, wantsPush, cameraState, pushOn, complete])

  if (tourOpen || completed || dismissed || !needsSetup) return null
  if (!wantsCamera && !wantsPush) return null
  if (cameraState === 'granted' && !wantsPush) return null

  async function allowAccess() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      let cameraOk = cameraState === 'granted'
      if (wantsCamera && !cameraOk) {
        const result = await primeCameraAccess()
        cameraOk = result === 'granted'
        setCameraState(cameraOk ? 'granted' : result === 'denied' ? 'denied' : 'unknown')
        if (result === 'denied') {
          setError(
            'Camera was blocked. On Android: lock/tune icon by the URL → Site settings → Camera → Allow (or App info → Permissions → Camera), then tap Allow again.',
          )
          setBusy(false)
          return
        }
        if (result === 'unavailable') {
          setError('Camera could not be opened on this device. You can still look up badges by ID.')
        } else {
          showToast('Camera is ready for badge scanning')
        }
      }

      if (wantsPush) {
        try {
          await enablePush(eventSlug)
          setPushOn(true)
          showToast('Notifications are on')
        } catch (err) {
          // Camera may still have succeeded — do not block completion.
          setError(err?.message || 'Notifications were not enabled. You can turn them on later under More.')
        }
      }

      complete()
    } catch (err) {
      setError(err?.message || 'Could not finish permissions setup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      role="region"
      aria-label="Allow app permissions"
      className="lift mx-4 flex items-start gap-3 rounded-2xl border border-sun/40 bg-white p-3.5 shadow-sm"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sun text-ink">
        <ShieldCheck size={18} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[15px] font-bold leading-snug">Allow permissions for a smooth experience</span>
        <span className="text-[12px] leading-snug text-muted">
          CPHIA needs a few device permissions. Tap Allow when your phone asks — you can change this later in browser or app settings.
        </span>
        <ul className="mt-1 flex flex-col gap-1 text-[12px] leading-snug text-ink">
          {wantsCamera && (
            <li className="flex items-start gap-2">
              <Camera size={14} className="mt-0.5 shrink-0 text-tertiary" aria-hidden="true" />
              <span>
                <strong>Camera</strong> — scan badge and app QR codes at the desk
                {cameraState === 'denied' ? ' (currently blocked in settings)' : ''}
              </span>
            </li>
          )}
          {wantsPush && (
            <li className="flex items-start gap-2">
              <BellRing size={14} className="mt-0.5 shrink-0 text-tertiary" aria-hidden="true" />
              <span>
                <strong>Notifications</strong> — programme, transport and desk updates
              </span>
            </li>
          )}
        </ul>
        <button
          type="button"
          onClick={allowAccess}
          disabled={busy}
          className="mt-1.5 h-9 self-start rounded-full bg-tertiary px-4 text-[14px] font-bold text-cream disabled:opacity-60"
        >
          {busy ? 'Please wait…' : 'Allow permissions'}
        </button>
        {error && <p role="alert" className="text-sm font-semibold text-maroon">{error}</p>}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  )
}
