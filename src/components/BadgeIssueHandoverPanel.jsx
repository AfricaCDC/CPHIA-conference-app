import { formatDateTime } from '../lib/format'

/**
 * Shows how an already-issued badge was handed over.
 * Single issue → short “picked up by the owner” line.
 * Multi-issue → collapsible panel with collector, remarks, photos, staff.
 */
export default function BadgeIssueHandoverPanel({ person, className = '' }) {
  const handover = person?.issue_handover
  if (!person?.badge_issued_at || !handover) return null

  if (handover.mode === 'single' || handover.collected_by_owner) {
    return (
      <div className={`rounded-xl border border-teal/30 bg-mint-soft/50 px-3 py-2 ${className}`.trim()}>
        <span className="text-[13px] font-bold text-ink">
          {handover.label || 'Picked up by the owner'}
        </span>
        {(handover.issued_at || handover.issued_by_name) && (
          <span className="mt-0.5 block text-[12px] text-muted">
            {[
              handover.issued_at ? formatDateTime(handover.issued_at) : null,
              handover.issued_by_name ? `by ${handover.issued_by_name}` : null,
            ].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
    )
  }

  const collectorName = handover.collector?.name || 'Someone at the desk'
  const collectorBadge = handover.collector?.badge_id != null
    ? `badge ${handover.collector.badge_id}`
    : null
  const summary = [
    `Collected by ${collectorName}`,
    collectorBadge,
    handover.issued_count > 1 ? `${handover.issued_count} badges in this hand-over` : null,
  ].filter(Boolean).join(' · ')

  return (
    <details className={`group rounded-xl border border-teal/40 bg-mint-soft/40 open:bg-mint-soft/70 ${className}`.trim()}>
      <summary className="cursor-pointer list-none px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold uppercase tracking-wide text-teal">Multi-issue hand-over</span>
            <span className="mt-0.5 block truncate text-[13px] font-bold text-ink">{summary}</span>
          </div>
          <span className="shrink-0 text-[12px] font-bold text-muted group-open:hidden">Details</span>
          <span className="hidden shrink-0 text-[12px] font-bold text-muted group-open:inline">Hide</span>
        </div>
      </summary>
      <dl className="grid gap-2 border-t border-teal/20 px-3 py-2.5 text-[13px]">
        <Row label="Collected by" value={[collectorName, collectorBadge].filter(Boolean).join(' · ')} />
        {handover.remarks && <Row label="Remarks" value={handover.remarks} />}
        <Row
          label="Evidence photos"
          value={handover.photo_count > 0
            ? `${handover.photo_count} on file`
            : 'None attached'}
        />
        {handover.issued_count > 0 && (
          <Row label="Badges in hand-over" value={String(handover.issued_count)} />
        )}
        {handover.issued_at && (
          <Row label="Issued" value={formatDateTime(handover.issued_at)} />
        )}
        {handover.issued_by_name && (
          <Row label="Staff" value={handover.issued_by_name} />
        )}
        {handover.note && handover.note !== handover.remarks && (
          <Row label="Issue note" value={handover.note} />
        )}
      </dl>
    </details>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="m-0 whitespace-pre-wrap break-words font-semibold text-ink">{value}</dd>
    </div>
  )
}
