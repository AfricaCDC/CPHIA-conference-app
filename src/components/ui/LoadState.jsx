import { IonSpinner } from '@ionic/react'
import { RotateCw } from 'lucide-react'
import Button from './Button'

/** Shows a spinner line, an error with retry, or the children. */
export function LoadState({ loading, error, onRetry, children }) {
  if (loading) {
    return (
      <div className="empty flex justify-center py-6" role="status">
        <IonSpinner name="crescent" color="dark" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }
  if (error) {
    return (
      <div role="alert" className="space-y-3 py-6 text-center">
        <p className="text-sm font-semibold">{navigator.onLine ? error.message : 'You are offline. Connect to load this.'}</p>
        {onRetry && <Button size="sm" variant="secondary" icon={RotateCw} onClick={onRetry}>Try again</Button>}
      </div>
    )
  }
  return <div className="flex flex-col gap-3">{children}</div>
}
