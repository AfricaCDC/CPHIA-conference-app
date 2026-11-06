import { useInstallStore } from '../store/installStore'

// Runs once at start-up, before any screen mounts, so the browser's one-time install event is not missed.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  useInstallStore.getState().setDeferredPrompt(event)
})

window.addEventListener('appinstalled', () => {
  useInstallStore.getState().setDeferredPrompt(null)
})
