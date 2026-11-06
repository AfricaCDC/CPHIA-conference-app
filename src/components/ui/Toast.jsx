import { useEffect } from 'react'
import { useAppStore } from '../../store/appStore'

const TOAST_DURATION_MS = 3000

/**
 * Short messages after an action. It is drawn inside the phone frame, above the tab bar. Ionic's own
 * toast is mounted on the page outside the frame, and remounting it crashed React on save.
 */
export default function Toast() {
  const toast = useAppStore((state) => state.toast)
  const clearToast = useAppStore((state) => state.clearToast)

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(clearToast, TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast, clearToast])

  if (!toast) return null

  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-4 bottom-24 z-50 flex justify-center"
    >
      <p
        className="max-w-md rounded-xl px-4 py-2.5 text-center text-[13px] font-extrabold shadow-lg"
        style={{ background: 'rgb(var(--c-ink))', color: 'rgb(var(--c-secondary))' }}
      >
        {toast.message}
      </p>
    </div>
  )
}
