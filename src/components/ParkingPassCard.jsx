import { Car, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'

const LEVEL_STYLE = {
  vip: { band: 'bg-sun text-ink', chip: 'VIP lot', hint: 'VIP reserved parking' },
  staff: { band: 'bg-teal text-ink', chip: 'Staff lot', hint: 'Staff parking level' },
  delegate: { band: 'bg-teal-dark text-cream', chip: 'Delegate lot', hint: 'Delegate parking level' },
}

/** Parking usher result: clear pass verdict with level emphasis. */
export default function ParkingPassCard({ result }) {
  if (!result) return null

  if (result.error || result.valid === false) {
    return (
      <article className="overflow-hidden rounded-2xl border border-maroon/30 bg-white shadow-sm">
        <div className="flex items-start gap-3 p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-maroon text-cream">
            <XCircle size={26} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[15px] font-black text-maroon">Not a valid pass</p>
            <p className="m-0 mt-1 text-[12px] leading-snug text-muted">
              This code is missing, revoked, or not for this event. Ask the delegate to show another pass or send them to the transport desk.
            </p>
          </div>
        </div>
      </article>
    )
  }

  const level = String(result.level || 'delegate').toLowerCase()
  const style = LEVEL_STYLE[level] ?? LEVEL_STYLE.delegate
  const label = result.label || `${style.chip}`
  const code = result.code || result.pass_code || null

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className={`flex items-center justify-between gap-3 px-4 py-3 ${style.band}`}>
        <div className="flex items-center gap-2">
          <Car size={20} aria-hidden="true" />
          <span className="text-[13px] font-black uppercase tracking-[0.12em]">{style.chip}</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-extrabold">
          <CheckCircle2 size={13} aria-hidden="true" /> Valid
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="lab m-0">Pass opens</p>
          <p className="m-0 mt-1 text-[22px] font-black leading-none text-ink">{label}</p>
          <p className="m-0 mt-1.5 text-[12px] text-muted">{style.hint}</p>
        </div>

        {code && (
          <div className="rounded-xl border border-dashed border-line bg-cream/80 px-3 py-2.5">
            <p className="lab m-0">Pass code</p>
            <p className="m-0 mt-1 font-mono text-[16px] font-black tracking-wider text-ink">{code}</p>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl bg-mint-soft/70 px-3 py-2.5 text-[12px] leading-snug text-ink">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-teal-dark" aria-hidden="true" />
          <span>Wave the vehicle through to the matching lot. Keep the pass with the driver for exit checks.</span>
        </div>
      </div>
    </article>
  )
}
