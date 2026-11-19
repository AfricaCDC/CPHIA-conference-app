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

const AUTO_HIDE_MS = 5000

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true
  )
}

/**
 * Short-lived post-install nudge for camera + notifications.
 * Hidden entirely when permissions are already granted; auto-dismisses after a few seconds.
 */
export default function PermissionsPrompt({ autoHideMs = AUTO_HIDE_MS } = {}) {
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
  const [cameraState, setCameraState] = useState(null)
  const [pushOn, setPushOn] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (isStandaloneDisplay() && !completed && !dismissed) {
      requestSetup()
    }
  }, [completed, dismissed, requestSetup])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      queryCameraPermission(),
      currentSubscription().then((sub) => Boolean(sub)).catch(() => false),
    ]).then(([cam, push]) => {
      if (cancelled) return
      setCameraState(cam)
      setPushOn(push)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [needsSetup])

  const notificationGranted =
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  const wantsCamera = cameraSupported() && (canScan || isStandaloneDisplay())
  // Hide the push row when the OS already granted notifications (even before a push subscription exists).
  const wantsPush = pushSupported() && !needsHomeScreenInstall() && !notificationGranted && pushOn === false
  // Android Chrome often returns "unknown" for camera even when already allowed — do not keep
  // showing this card unless Permissions API explicitly says prompt or denied.
  const cameraNeedsPrompt = wantsCamera && (cameraState === 'prompt' || cameraState === 'denied')
  const alreadyGranted = ready && !cameraNeedsPrompt && !wantsPush

  useEffect(() => {
    if (!needsSetup || completed || dismissed || !ready) return
    if (alreadyGranted) {
      complete()
    }
  }, [needsSetup, completed, dismissed, ready, alreadyGranted, complete])

  // Auto-hide on the homepage after a few seconds if the user ignores it.
  useEffect(() => {
    if (!needsSetup || completed || dismissed || !ready || alreadyGranted) return undefined
    if (!autoHideMs || autoHideMs <= 0) return undefined
    const timer = window.setTimeout(() => dismiss(), autoHideMs)
    return () => window.clearTimeout(timer)
  }, [needsSetup, completed, dismissed, ready, alreadyGranted, autoHideMs, dismiss])

  if (!ready || tourOpen || completed || dismissed || !needsSetup) return null
  if (alreadyGranted) return null
  if (!cameraNeedsPrompt && !wantsPush) return null

  async function allowAccess() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (cameraNeedsPrompt) {
        const result = await primeCameraAccess()
        setCameraState(result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'unknown')
        if (result === 'denied') {
          setError(
            'Camera was not allowed. Tap Allow on the system dialog. If it never appeared, open Chrome site settings → Camera → Allow, then try again.',
          )
          setBusy(false)
          return
        }
        if (result === 'granted') {
          showToast('Camera is ready for badge scanning')
        }
      }

      if (wantsPush) {
        try {
          await enablePush(eventSlug)
          setPushOn(true)
          showToast('Notifications are on')
        } catch (err) {
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
          Tap the button below — your phone will ask for access. You can change this later in settings.
        </span>
        <ul className="mt-1 flex flex-col gap-1 text-[12px] leading-snug text-ink">
          {cameraNeedsPrompt && (
            <li className="flex items-start gap-2">
              <Camera size={14} className="mt-0.5 shrink-0 text-tertiary" aria-hidden="true" />
              <span><strong>Camera</strong> — scan badge and app QR codes</span>
            </li>
          )}
          {wantsPush && (
            <li className="flex items-start gap-2">
              <BellRing size={14} className="mt-0.5 shrink-0 text-tertiary" aria-hidden="true" />
              <span><strong>Notifications</strong> — programme, transport and desk updates</span>
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
