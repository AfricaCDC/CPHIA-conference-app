import { useInstallStore } from '../store/installStore'
import { usePermissionsPromptStore } from '../store/permissionsPromptStore'

// Runs once at start-up, before any screen mounts, so the browser's one-time install event is not missed.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  useInstallStore.getState().setDeferredPrompt(event)
})

window.addEventListener('appinstalled', () => {
  useInstallStore.getState().setDeferredPrompt(null)
  // After install, ask for camera / notifications on a user gesture (Android will not
  // prompt for camera without one — and will not re-prompt if previously denied).
  usePermissionsPromptStore.getState().requestSetup()
})
