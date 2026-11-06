import { IonButton } from '@ionic/react'

// Wireframe buttons: ink (primary), yellow (accent), outline (secondary), maroon (danger).
const VARIANTS = {
  primary: '',
  accent: 'y',
  secondary: 'o',
  danger: 'm',
  teal: 't',
  ghost: 'o border-transparent',
}

/**
 * The app's button, drawn by Ionic so it gets native press feedback on iOS and Android.
 * The colours and shape still come from the .btn classes, so the look stays the same.
 */
export default function Button({ variant = 'primary', size = 'md', icon: Icon, className = '', children, onClick, disabled, ...props }) {
  return (
    // Ionic does not pass React click handlers through, so the tap is read here in the capture phase.
    <span className="contents" onClickCapture={disabled ? undefined : onClick}>
      <IonButton
        fill="clear"
        type="button"
        disabled={disabled}
        className={`btn app-btn ${VARIANTS[variant] ?? ''} ${size === 'sm' ? 'sm' : ''} ${className}`}
        {...props}
      >
        {Icon && <Icon size={18} aria-hidden="true" />}
        {children}
      </IonButton>
    </span>
  )
}
