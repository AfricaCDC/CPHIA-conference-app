import { useEffect, useState } from 'react'
import { BellOff, BellRing } from 'lucide-react'
import Button from './ui/Button'
import Card, { CardTitle } from './ui/Card'
import { currentSubscription, disablePush, enablePush, needsHomeScreenInstall, pushSupported } from '../lib/push'
import { useEventSlug } from '../lib/useParticipant'
import { useAppStore } from '../store/appStore'

/** Turns push notifications on or off for this device. */
export default function PushCard() {
  const eventSlug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    currentSubscription().then((subscription) => setEnabled(Boolean(subscription))).catch(() => {})
  }, [])

  async function toggle() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (enabled) {
        await disablePush()
        setEnabled(false)
        showToast('Push notifications turned off', 'info')
      } else {
        await enablePush(eventSlug)
        setEnabled(true)
        showToast('Push notifications are on')
      }
    } catch (err) {
      setError(err?.message || 'Could not update notifications. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!pushSupported()) {
    return (
      <Card>
        <CardTitle icon={BellOff}>Push notifications</CardTitle>
        <p className="text-subtle text-sm">
          {needsHomeScreenInstall()
            ? 'On iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then open it from there to turn on notifications.'
            : 'This browser does not support push notifications.'}
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle icon={enabled ? BellRing : BellOff}>Push notifications</CardTitle>
      <p className="text-subtle mb-3 text-sm">
        {enabled
          ? 'On for this device: messages, badge, travel, hotel, transport and announcements.'
          : 'Get messages, badge collection, travel, hotel, transport and announcement updates on this device.'}
      </p>
      <Button className="w-full" variant={enabled ? 'secondary' : 'accent'} icon={enabled ? BellOff : BellRing} disabled={busy} onClick={toggle}>
        {busy ? 'Please wait…' : enabled ? 'Turn off' : 'Turn on notifications'}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-maroon dark:text-[#E0587A]">{error}</p>}
    </Card>
  )
}
