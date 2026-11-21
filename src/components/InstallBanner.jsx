import { Download, Share, X } from 'lucide-react'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import { isAndroidDevice, isIosDevice, shouldOfferInstall } from '../lib/install'
import { useInstallStore } from '../store/installStore'
import { usePermissionsPromptStore } from '../store/permissionsPromptStore'
import { useAppStore } from '../store/appStore'

/**
 * Asks the delegate to install the app (browser PWA only).
 * Android / Chrome: Install button when available, otherwise Chrome menu steps.
 * iPhone / iPad: must use Safari → Share → Add to Home Screen.
 */
export default function InstallBanner() {
  const { canInstall, install } = useInstallPrompt()
  const dismissed = useInstallStore((state) => state.dismissed)
  const dismiss = useInstallStore((state) => state.dismiss)
  const requestSetup = usePermissionsPromptStore((state) => state.requestSetup)
  const showToast = useAppStore((state) => state.showToast)
  const ios = isIosDevice()
  const android = isAndroidDevice()

  if (dismissed || !shouldOfferInstall()) return null

  async function handleInstall() {
    const accepted = await install()
    if (accepted) {
      showToast('CPHIA 2026 is on your home screen')
      requestSetup()
    }
  }

  return (
    <section role="region" aria-label="Install the app" className="lift mx-4 flex items-start gap-3 rounded-2xl bg-white p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/25 text-tertiary">
        {ios ? <Share size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-bold">Install CPHIA 2026</span>
        {ios ? (
          <span className="text-[12px] leading-snug text-muted">
            On iPhone or iPad you <b className="text-ink">must open this page in Safari</b> (not Chrome or an in-app browser).
            Then tap Share → Add to Home Screen → Add. After opening it from your home screen, allow Camera and Notifications when asked.
          </span>
        ) : (
          <span className="text-[12px] leading-snug text-muted">
            {android
              ? 'Add CPHIA 2026 to your home screen. In Chrome, tap ⋮ then Install app or Add to Home screen. We will ask for camera and notifications after install.'
              : 'Install CPHIA 2026 to your device. In Chrome, use Install app from the browser menu.'}
          </span>
        )}
        {!ios && canInstall && (
          <button type="button" onClick={handleInstall} className="mt-1 h-9 self-start rounded-full bg-tertiary px-4 text-[14px] font-bold text-cream">
            Install
          </button>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-full text-muted">
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  )
}
