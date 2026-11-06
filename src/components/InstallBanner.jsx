import { Download, Share, X } from 'lucide-react'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import { needsHomeScreenInstall } from '../lib/push'
import { useInstallStore } from '../store/installStore'
import { useAppStore } from '../store/appStore'

/**
 * Asks the delegate to install the app. Chrome, Edge and Android get a real install button; iPhone and iPad
 * (no install prompt in Safari) get the steps. Dismissing it hides it for good on this device.
 */
export default function InstallBanner() {
  const { canInstall, install } = useInstallPrompt()
  const dismissed = useInstallStore((state) => state.dismissed)
  const dismiss = useInstallStore((state) => state.dismiss)
  const showToast = useAppStore((state) => state.showToast)
  const ios = needsHomeScreenInstall()

  if (dismissed || (!canInstall && !ios)) return null

  async function handleInstall() {
    const accepted = await install()
    if (accepted) showToast('CPHIA 2026 is on your home screen')
  }

  return (
    <section role="region" aria-label="Install the app" className="lift mx-4 flex items-start gap-3 rounded-2xl bg-white p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/25 text-tertiary">
        {ios ? <Share size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-bold">Install CPHIA 2026</span>
        {ios ? (
          <span className="text-[12px] leading-snug text-muted">Tap Share, then “Add to Home Screen” to open the app like any other app.</span>
        ) : (
          <span className="text-[12px] leading-snug text-muted">Open it from your home screen, with notifications for your updates.</span>
        )}
        {!ios && <button type="button" onClick={handleInstall} className="mt-1 h-9 self-start rounded-full bg-tertiary px-4 text-[14px] font-bold text-cream">Install</button>}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-full text-muted">
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  )
}
