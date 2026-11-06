import { useInstallStore } from '../store/installStore'

/** Whether the browser can install the app now, and a function that opens its install dialog. */
export function useInstallPrompt() {
  const deferredPrompt = useInstallStore((state) => state.deferredPrompt)
  const setDeferredPrompt = useInstallStore((state) => state.setDeferredPrompt)

  async function install() {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return choice.outcome === 'accepted'
  }

  return { canInstall: deferredPrompt !== null, install }
}
