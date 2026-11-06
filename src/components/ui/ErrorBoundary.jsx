import { Component } from 'react'
import { IonIcon } from '@ionic/react'
import { alertCircleOutline, homeOutline, refreshOutline } from 'ionicons/icons'
import { useAppStore } from '../../store/appStore'

export const SCREEN_ERROR_MESSAGE = 'This screen could not load. You have been returned to the home page.'

/**
 * Catches a crash or a failed screen download. If the failed screen is not home, the app returns home
 * with a notice; on home itself the boundary shows the message with Try again and Go to home.
 * Render it with a `key` that changes per screen so navigating away clears the error.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
    this.retry = () => this.setState({ failed: false })
    this.goHome = () => {
      this.setState({ failed: false })
      useAppStore.getState().goHome()
    }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('Screen failed to render', error, info?.componentStack)
    const { screen, showNotice, goHome } = useAppStore.getState()
    showNotice(SCREEN_ERROR_MESSAGE)
    if (screen !== 'home') goHome()
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <IonIcon icon={alertCircleOutline} aria-hidden="true" className="text-5xl text-red-700" />
        <p className="text-base font-extrabold">This screen could not be shown.</p>
        <p className="text-sm text-muted">Check your connection, then try again. Your details are safe.</p>
        <div className="flex gap-2">
          <button type="button" className="btn sm" onClick={this.retry}>
            <IonIcon icon={refreshOutline} aria-hidden="true" />
            Try again
          </button>
          <button type="button" className="btn o sm" onClick={this.goHome}>
            <IonIcon icon={homeOutline} aria-hidden="true" />
            Go to home
          </button>
        </div>
      </div>
    )
  }
}
