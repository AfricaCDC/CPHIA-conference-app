import { deskInfo } from '../../lib/desks'

/**
 * Staff desk picker. Always uses dark text on a white field so the selected desk
 * stays readable (the header select used cream-on-white and looked empty).
 */
export default function DeskSwitcher({
  id = 'desk-switch',
  desks = [],
  value,
  onChange,
  label = 'Desk',
  className = '',
  /** On the dark staff header use cream; on a white card use muted. */
  labelTone = 'cream',
}) {
  if (!desks.length) return null

  return (
    <div className={className}>
      {label ? (
        <label className={`lab ${labelTone === 'muted' ? 'text-muted' : 'text-cream/80'}`} htmlFor={id}>{label}</label>
      ) : null}
      <select
        id={id}
        aria-label={label || 'Switch staff desk'}
        className="mt-1 w-full rounded-full border-2 border-sun bg-white px-3.5 py-2.5 text-sm font-extrabold text-ink shadow-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {desks.map((entry) => {
          const title = deskInfo(entry.key).kicker || entry.label
          return (
            <option key={entry.key} value={entry.key} className="bg-white text-ink">
              {entry.own ? `${title} · your role` : title}
            </option>
          )
        })}
      </select>
    </div>
  )
}
