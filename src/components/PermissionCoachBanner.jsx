import { Eye } from 'lucide-react'

/**
 * Fixed top coach while waiting for Android’s Allow chip.
 * On installed PWAs that chip often sits under the status bar (not centered like notifications).
 */
export default function PermissionCoachBanner({
  active = false,
  title = 'Look at the TOP of the screen',
  detail = 'Tap Allow if a small prompt appears near the status bar. It is easy to miss on installed Android apps.',
}) {
  if (!active) return null

  return (
    <div
      role="status"
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] px-3 pt-[calc(env(safe-area-inset-top)+8px)]"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border-2 border-sun bg-ink px-3.5 py-3 text-cream shadow-lg shadow-black/40">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-sun text-ink">
          <Eye size={18} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-extrabold leading-snug">{title}</span>
          <span className="text-[12px] leading-snug text-cream/85">{detail}</span>
        </span>
      </div>
    </div>
  )
}
