import { useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import {
  currentSubscription,
  enablePush,
  needsHomeScreenInstall,
  pushSupported,
} from '../lib/push'
import { useEventSlug } from '../lib/useParticipant'
import { useAppStore } from '../store/appStore'
import { usePushPromptStore } from '../store/pushPromptStore'

/**
 * First-run recommendation to turn on push so delegates get announcements,
 * transport, badge and desk updates. Shown once on Home until enabled or dismissed.
 */
export default function PushPrompt() {
  const eventSlug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const tourOpen = useAppStore((state) => state.tourOpen)
  const dismissed = usePushPromptStore((state) => state.dismissed)
  const dismiss = usePushPromptStore((state) => state.dismiss)
  const [enabled, setEnabled] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    currentSubscription()
      .then((subscription) => {
        if (!cancelled) setEnabled(Boolean(subscription))
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (tourOpen || dismissed || enabled === null || enabled) return null
  if (!pushSupported() && !needsHomeScreenInstall()) return null

  const iosInstallFirst = needsHomeScreenInstall()

  async function turnOn() {
    if (busy || iosInstallFirst) return
    setBusy(true)
    setError(null)
    try {
      await enablePush(eventSlug)
      setEnabled(true)
      dismiss()
      showToast('Push notifications are on — you will get event updates')
    } catch (err) {
      setError(err?.message || 'Could not turn on notifications. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      role="region"
      aria-label="Turn on notifications"
      className="lift mx-4 flex items-start gap-3 rounded-2xl border border-tertiary/25 bg-white p-3.5 shadow-sm"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tertiary text-cream">
        <BellRing size={18} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[15px] font-bold leading-snug">Stay updated on the event</span>
        <span className="text-[12px] leading-snug text-muted">
          Turn on notifications for announcements, programme changes, transport, badge collection and messages from the organisers.
        </span>
        {iosInstallFirst ? (
          <span className="text-[12px] font-semibold leading-snug text-tertiary">
            On iPhone: Share → Add to Home Screen, open the app from there, then turn notifications on.
          </span>
        ) : (
          <button
            type="button"
            onClick={turnOn}
            disabled={busy}
            className="mt-1 h-9 self-start rounded-full bg-tertiary px-4 text-[14px] font-bold text-cream disabled:opacity-60"
          >
            {busy ? 'Please wait…' : 'Turn on notifications'}
          </button>
        )}
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
