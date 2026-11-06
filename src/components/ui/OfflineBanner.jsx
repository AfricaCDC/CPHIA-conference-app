import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

export default function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribe, () => navigator.onLine)
  if (isOnline) return null

  return (
    <div role="status" className="flex items-center gap-2 bg-ink px-4 py-2 text-sm text-white">
      <WifiOff size={16} aria-hidden="true" />
      You are offline. Your badge, schedule and saved pages still work.
    </div>
  )
}
