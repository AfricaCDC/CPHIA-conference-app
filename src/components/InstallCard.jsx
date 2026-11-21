import { Download, Share, Smartphone } from 'lucide-react'
import Button from './ui/Button'
import Card, { CardTitle } from './ui/Card'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import { isAndroidDevice, isIosDevice, isRunningAsInstalledApp, shouldOfferInstall } from '../lib/install'
import { useAppStore } from '../store/appStore'
import { usePermissionsPromptStore } from '../store/permissionsPromptStore'

/**
 * Full iOS + Android install instructions for the Conference PWA.
 * Browser PWA only — hidden in the native APK and when already installed.
 */
export default function InstallCard() {
  const { canInstall, install } = useInstallPrompt()
  const showToast = useAppStore((state) => state.showToast)
  const requestSetup = usePermissionsPromptStore((state) => state.requestSetup)
  const installed = isRunningAsInstalledApp()
  const ios = isIosDevice()
  const android = isAndroidDevice()

  if (installed) {
    return (
      <Card>
        <CardTitle>Installed</CardTitle>
        <p className="text-sm text-muted">
          CPHIA 2026 is running from your home screen. Open it from the app icon for the best experience.
        </p>
      </Card>
    )
  }

  if (!shouldOfferInstall()) return null

  async function handleInstall() {
    const accepted = await install()
    if (accepted) {
      showToast('CPHIA 2026 is on your home screen')
      requestSetup()
    }
  }

  return (
    <Card>
      <CardTitle>Install this app</CardTitle>
      <p className="mb-3 text-sm text-muted">
        Add CPHIA 2026 to your home screen so the programme, badge and updates open like a normal app.
      </p>

      {canInstall && (
        <Button icon={Download} className="mb-3 w-full" onClick={handleInstall}>
          Install CPHIA 2026
        </Button>
      )}

      <div className={`mb-3 rounded-xl border p-3 ${ios ? 'border-teal bg-mint-soft/40' : 'border-line'}`}>
        <div className="mb-2 flex items-center gap-2">
          <Share size={16} className="text-tertiary" aria-hidden="true" />
          <span className="text-sm font-extrabold">iPhone &amp; iPad — Safari only</span>
          {ios && <span className="rounded-full bg-sun px-2 py-0.5 text-[10px] font-bold text-ink">Your device</span>}
        </div>
        <p className="mb-2 text-sm font-semibold text-ink">
          You must open this page in Safari. Chrome and in-app browsers on iPhone cannot install the app.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Copy this link and open it in <b className="text-ink">Safari</b>.</li>
          <li>Tap the <b className="text-ink">Share</b> button (square with an arrow) at the bottom.</li>
          <li>Scroll and tap <b className="text-ink">Add to Home Screen</b>.</li>
          <li>Tap <b className="text-ink">Add</b>, then open <b className="text-ink">CPHIA 2026</b> from your home screen.</li>
        </ol>
      </div>

      <div className={`rounded-xl border p-3 ${android ? 'border-teal bg-mint-soft/40' : 'border-line'}`}>
        <div className="mb-2 flex items-center gap-2">
          <Smartphone size={16} className="text-tertiary" aria-hidden="true" />
          <span className="text-sm font-extrabold">Android (Chrome)</span>
          {android && <span className="rounded-full bg-sun px-2 py-0.5 text-[10px] font-bold text-ink">Your device</span>}
        </div>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Open this page in <b className="text-ink">Chrome</b>.</li>
          <li>Tap the <b className="text-ink">⋮</b> menu (top right).</li>
          <li>Tap <b className="text-ink">Install app</b> or <b className="text-ink">Add to Home screen</b>.</li>
          <li>Confirm, then open <b className="text-ink">CPHIA 2026</b> from your home screen.</li>
        </ol>
        {!canInstall && (
          <p className="mt-2 text-xs text-muted">
            If Install app is missing, use Add to Home screen in the same menu, or refresh and try again.
          </p>
        )}
      </div>
    </Card>
  )
}
