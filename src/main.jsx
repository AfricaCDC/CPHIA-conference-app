import React from 'react'
import ReactDOM from 'react-dom/client'
import { IonApp } from '@ionic/react'
import '@ionic/react/css/core.css'
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'
import '@ionic/react/css/display.css'
import '@ionic/react/css/padding.css'
import '@ionic/react/css/flex-utils.css'
import './lib/installPrompt'
import App from './App'
import { configureIonic, ionicModeFor } from './lib/ionicMode'
import { resolvedStyle, useBrandStore } from './store/brandStore'
import './index.css'

/** Ionic wraps the app. Its look follows the chosen Appearance; a change remounts Ionic so every part redraws. */
function IonicRoot() {
  const styleMode = useBrandStore((state) => state.styleMode)
  const style = resolvedStyle(styleMode)
  configureIonic(style)

  return (
    <IonApp key={ionicModeFor(style)}>
      <div className="phone-frame">
        <App />
      </div>
    </IonApp>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IonicRoot />
  </React.StrictMode>,
)

// The service worker only runs in production builds so it never caches dev-server modules.
// Native apps ship the bundle inside the app, so they skip it.
if ('serviceWorker' in navigator && import.meta.env.PROD && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => {
    // Public site is at /app (no slash); default SW scope /app/ would never control it.
    Promise.all([import('./lib/push'), import('./lib/appUpdate')])
      .then(async ([{ ensureServiceWorker }, { startAppUpdater }]) => {
        const registration = await ensureServiceWorker()
        startAppUpdater(registration)
      })
      .catch((error) => {
        console.error('Service worker registration failed', error)
      })
  })
}
