import { useEffect } from 'react'
import { IonIcon } from '@ionic/react'
import { alertCircleOutline, closeOutline } from 'ionicons/icons'
import { useAppStore } from '../../store/appStore'

const NOTICE_DURATION_MS = 10000

/** A dismissible error banner shown above the current screen, e.g. after the app returns home from a failure. */
export default function ErrorNotice() {
  const notice = useAppStore((state) => state.notice)
  const clearNotice = useAppStore((state) => state.clearNotice)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(clearNotice, NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [notice, clearNotice])

  if (!notice) return null

  return (
    <div role="alert" className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <IonIcon icon={alertCircleOutline} aria-hidden="true" className="mt-0.5 shrink-0 text-xl" />
      <p className="flex-1 font-semibold">{notice.message}</p>
      <button type="button" className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-red-900" onClick={clearNotice} aria-label="Dismiss message">
        <IonIcon icon={closeOutline} aria-hidden="true" className="text-xl" />
      </button>
    </div>
  )
}
