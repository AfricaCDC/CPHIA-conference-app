import { setupIonicReact } from '@ionic/react'

/** Ionic draws its components in the iOS or Material look. The app picks the same look as its own styles. */
export function ionicModeFor(style) {
  return style === 'ios' ? 'ios' : 'md'
}

/** Applies the look to Ionic before its components render. */
export function configureIonic(style) {
  const mode = ionicModeFor(style)
  setupIonicReact({ mode, animated: false })
  return mode
}
