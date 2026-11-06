const TONES = { teal: 't', maroon: 'm', sun: 'y', gold: 'y', ink: 'bg-ink text-cream', mint: '' }

/** Small pill used for categories, statuses and counts. */
export default function Badge({ tone = 'mint', className = '', children }) {
  return <span className={`pill ${TONES[tone] ?? ''} ${className}`}>{children}</span>
}
