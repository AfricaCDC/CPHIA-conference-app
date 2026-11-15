import { IonChip, IonHeader, IonToolbar } from '@ionic/react'
import { ChevronLeft } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

/**
 * The wireframe header: dark band, small teal kicker, bold title, optional back button,
 * actions on the right and chips or a search field underneath.
 */
export default function ScreenHeader({ kicker, title, subtitle = null, tone = '', back = false, right = null, children }) {
  const goBack = useAppStore((state) => state.goBack)

  return (
    <IonHeader className={`hdr-host ion-no-border sticky top-0 z-20 ${tone}`}>
      <IonToolbar className="hdr-toolbar">
        <div className="hdr">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {back && (
                <button type="button" className="iconbtn" onClick={goBack} aria-label="Back">
                  <ChevronLeft size={22} aria-hidden="true" />
                </button>
              )}
              <div className="flex min-w-0 flex-col gap-0.5">
                {kicker && <p className="kick truncate">{kicker}</p>}
                <h1 className="line-clamp-2">{title}</h1>
                {subtitle ? <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-cream/85">{subtitle}</p> : null}
              </div>
            </div>
            {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
          </div>
          {children}
        </div>
      </IonToolbar>
    </IonHeader>
  )
}

/** A header chip row. `light` renders chips on a pale background (inside the body). */
export function Chips({ label, options, value, onChange, light = false }) {
  return (
    // Ionic's chip does not pass React click handlers through, so the tap is read on this wrapper.
    <div
      role="group"
      aria-label={label}
      className={`chips ${light ? 'light mx-0 px-0' : ''}`}
      onClickCapture={(event) => {
        const chip = event.target.closest?.('ion-chip[data-chip]')
        if (chip) onChange(chip.dataset.chip)
      }}
    >
      {options.map((option) => (
        <IonChip key={option.id} data-chip={option.id} aria-pressed={value === option.id} className="chip">
          {option.label}
        </IonChip>
      ))}
    </div>
  )
}

/** Header icon button with an optional count badge. */
export function HeaderIcon({ icon: Icon, label, count = 0, onClick, tour }) {
  return (
    <button type="button" className="iconbtn" onClick={onClick} aria-label={count ? `${label}, ${count} unread` : label} data-tour={tour}>
      <Icon size={20} aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-maroon px-1 text-[11px] font-bold text-cream">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

/** Screen body under the header, with the wireframe's spacing. */
export function Body({ className = '', children }) {
  return <div className={`flex flex-col gap-3 px-4 pb-4 pt-3.5 ${className}`}>{children}</div>
}
