import { IonCard } from '@ionic/react'
import { ChevronRight } from 'lucide-react'
import ListRow from './ListRow'

/** Wireframe card. `tone` is yellow, mint, ink or teal. */
export default function Card({ tone = '', className = '', children, ...props }) {
  return (
    <IonCard className={`card app-card ${tone} ${className}`} {...props}>
      {children}
    </IonCard>
  )
}

export function CardTitle({ icon: Icon, children, aside }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="t flex items-center gap-2">
        {Icon && <Icon size={17} className="text-teal-dark" aria-hidden="true" />}
        {children}
      </h2>
      {aside}
    </div>
  )
}

/** A tappable card row: icon, title, subtitle, chevron. The tap is read on a wrapper, as Ionic does not pass React clicks through. */
export function LinkCard({ icon: Icon, title, subtitle, onClick, trailing, tone = '' }) {
  return (
    <div
      className="contents"
      onClickCapture={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onClick(event)
        }
      }}
    >
      <IonCard role="button" tabIndex={0} className={`card app-card row w-full text-left ${tone}`}>
        {Icon && (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint-soft text-ink">
            <Icon size={20} aria-hidden="true" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="t">{title}</span>
          {subtitle && <span className="s">{subtitle}</span>}
        </span>
        {trailing}
        <ChevronRight size={18} className="shrink-0 opacity-60" aria-hidden="true" />
      </IonCard>
    </div>
  )
}

/** A card that is also a button. The tap is read on a wrapper, as Ionic does not pass React clicks through. */
export function CardButton({ onClick, className = '', children }) {
  return (
    <div
      className="contents"
      onClickCapture={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onClick(event)
        }
      }}
    >
      <IonCard role="button" tabIndex={0} className={`card app-card ${className}`}>
        {children}
      </IonCard>
    </div>
  )
}

export function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-mint-soft py-2 last:border-0">
      <dt className="s">{label}</dt>
      <dd className="text-right text-sm font-bold">{value}</dd>
    </div>
  )
}

/** Status row with a coloured dot: state is ok, warn or off. */
export function StepRow({ state = 'off', title, detail }) {
  return (
    <ListRow>
      <span className={`dot ${state}`} aria-hidden="true">{state === 'ok' ? '✓' : state === 'warn' ? '!' : ''}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t">{title}</span>
        {detail && <span className="s">{detail}</span>}
      </span>
    </ListRow>
  )
}
