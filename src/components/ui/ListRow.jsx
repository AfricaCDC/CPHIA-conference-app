import { IonItem } from '@ionic/react'

/**
 * A row in a list, drawn by Ionic. Ionic does not pass React click handlers through, so the tap and
 * the Enter and Space keys are read on this wrapper.
 */
export default function ListRow({ onClick, disabled = false, className = '', children, ...props }) {
  const interactive = Boolean(onClick) && !disabled
  return (
    <div
      className="contents"
      onClickCapture={interactive ? onClick : undefined}
      onKeyDown={(event) => {
        if (interactive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onClick(event)
        }
      }}
    >
      <IonItem
        lines="none"
        detail={false}
        disabled={disabled}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        className={`li ${className}`}
        {...props}
      >
        {children}
      </IonItem>
    </div>
  )
}
