import { useState } from 'react'
import { Car, CheckCircle2, CloudOff, DoorOpen, IdCard, QrCode, ShieldAlert } from 'lucide-react'
import Avatar from './ui/Avatar'
import Badge from './ui/Badge'
import Button from './ui/Button'
import PersonBadgeQrModal from './PersonBadgeQrModal'
import { formatDateTime } from '../lib/format'

/** Staff scan / Find person result: photo + identity + access. View QR opens identify-only QR. */
export default function ScanPersonCard({
  person,
  busy = false,
  onCheckIn,
  showCheckIn = true,
}) {
  const [qrOpen, setQrOpen] = useState(false)

  if (!person) return null

  const badgeType = person.delegate_type || person.badge_type_label || person.badge_type || 'Delegate'
  const checkedIn = Boolean(person.checked_in_at || person.checked_in)
  const offline = Boolean(person.offline_cached)
  const isPlenaryCard = person.scan_card_type === 'plenary' || Boolean(person.plenary_display_code)
  const plenaryUnassigned = isPlenaryCard && (person.assigned === false || person.status === 'unassigned' || !person.id)
  const plenaryCode = person.plenary_display_code || person.display_code || null
  const plenaryCategoryLabel = person.plenary_category_name
    || (person.plenary_category_code === 'PR' ? 'Redzone' : person.plenary_category_code === 'P' ? 'Plenary' : person.plenary_category_code)
    || null
  const plenaryBadgesGranted = Number(person.plenary_access_badges_granted ?? 0)
  const hasPlenaryAccess = Boolean(person.has_plenary_access || person.plenary_access || plenaryBadgesGranted > 0)
  const displayName = person.name || (plenaryUnassigned ? 'Unassigned plenary card' : 'Unknown')
  const qrPayload = typeof person.qr_payload === 'string' ? person.qr_payload.trim() : ''
  const canShowQr = qrPayload !== ''
  const printLabel = person.print_status_label
    || (person.print_status === 'printed' ? 'Printed'
      : person.print_status === 'pending_print' ? 'Pending print'
        : person.badge_print_active ? 'Printed'
          : person.badge_id != null ? 'Pending print'
            : null)
  const issued = Boolean(person.badge_issued_at)

  return (
    <article className="scan-person overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex gap-3 p-3.5">
        <Avatar name={displayName} photoUrl={person.photo_url} size="xl" shape="square" className="size-[88px] text-2xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {plenaryUnassigned ? (
              <Badge tone="sun">Unassigned card</Badge>
            ) : (
              <Badge tone={checkedIn ? 'teal' : 'sun'}>{checkedIn ? 'Checked in' : 'Not checked in'}</Badge>
            )}
            {printLabel && (
              <Badge tone={person.print_status === 'printed' || person.badge_print_active ? 'teal' : 'sun'}>
                {printLabel}
              </Badge>
            )}
            {issued && <Badge tone="teal">Issued</Badge>}
            {isPlenaryCard && plenaryCategoryLabel && (
              <Badge tone={person.plenary_category_code === 'PR' || person.has_redzone_plenary_access ? 'maroon' : 'teal'}>
                <span className="inline-flex items-center gap-1">
                  <DoorOpen size={11} aria-hidden="true" /> {plenaryCategoryLabel}
                </span>
              </Badge>
            )}
            {offline && (
              <Badge tone="maroon">
                <span className="inline-flex items-center gap-1">
                  <CloudOff size={11} aria-hidden="true" /> Offline
                </span>
              </Badge>
            )}
          </div>
          <h2 className="m-0 text-[15px] font-black uppercase leading-tight tracking-wide text-ink">
            {displayName}
          </h2>
          {(person.organization || person.category) && (
            <p className="m-0 text-[12px] leading-snug text-muted">
              <span className="font-bold text-ink/70">Con/Org.</span>{' '}
              {[person.organization, person.category].filter(Boolean).join(' · ')}
            </p>
          )}
          {person.email && <p className="m-0 truncate text-[11px] text-muted">{person.email}</p>}
          {canShowQr && (
            <button
              type="button"
              className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-bold text-teal"
              onClick={() => setQrOpen(true)}
            >
              <QrCode size={12} aria-hidden="true" /> View QR
            </button>
          )}
        </div>
      </div>

      <dl className="mx-3.5 mb-3 grid grid-cols-2 gap-2 rounded-xl bg-mint-soft/60 p-2.5">
        <Detail label="Badge type" value={badgeType} />
        <Detail
          label={isPlenaryCard ? 'Plenary code' : 'Badge ID'}
          value={isPlenaryCard
            ? (plenaryCode || '—')
            : (person.badge_id != null ? String(person.badge_id) : '—')}
          icon={IdCard}
        />
        <Detail
          label="Box"
          value={(person.box_number ?? person.badge_packing_list) != null
            ? String(person.box_number ?? person.badge_packing_list)
            : '—'}
        />
        <Detail
          label="Batch"
          value={(person.batch_number ?? person.badge_box_batch) != null
            ? String(person.batch_number ?? person.badge_box_batch)
            : '—'}
        />
        <Detail label="Print" value={printLabel || '—'} />
        <Detail label="Issue" value={issued ? 'Issued' : 'Awaiting issue'} />
        {person.registration_code && (
          <Detail label="MoPD ID" value={String(person.registration_code)} />
        )}
        <Detail label="Status" value={person.status ? String(person.status).replace(/_/g, ' ') : '—'} />
        {person.collection_counter != null && (
          <Detail
            label="Counter"
            value={person.collection_counter_name || `Counter ${person.collection_counter}`}
          />
        )}
        {!isPlenaryCard && hasPlenaryAccess && (
          <Detail
            label="Plenary badges"
            value={String(Math.max(1, plenaryBadgesGranted || 1))}
          />
        )}
        {person.job_title && <Detail label="Job title" value={person.job_title} />}
        {person.nationality && <Detail label="Nationality" value={person.nationality} />}
        {person.gender && <Detail label="Gender" value={person.gender} />}
        {(person.stay?.hotel || person.hotel) && (
          <Detail label="Hotel" value={person.stay?.hotel || person.hotel} />
        )}
        {(person.stay?.room || person.room) && (
          <Detail label="Room" value={person.stay?.room || person.room} />
        )}
        {person.payment_status && (
          <Detail label="Payment" value={String(person.payment_status).replace(/_/g, ' ')} />
        )}
        {person.sponsorship && (
          <Detail label="Sponsorship" value={String(person.sponsorship).replace(/_/g, ' ')} />
        )}
      </dl>

      <div className="mx-3.5 mb-3 flex flex-wrap gap-1.5">
        {!isPlenaryCard && hasPlenaryAccess && (
          <Badge tone="teal">
            <span className="inline-flex items-center gap-1">
              <DoorOpen size={11} aria-hidden="true" /> Plenary · {Math.max(1, plenaryBadgesGranted || 1)}
            </span>
          </Badge>
        )}
        {person.has_car_parking_access && (
          <Badge tone="teal">
            <span className="inline-flex items-center gap-1">
              <Car size={11} aria-hidden="true" /> Parking
            </span>
          </Badge>
        )}
        {!isPlenaryCard && person.has_redzone_plenary_access && (
          <Badge tone="maroon">
            <span className="inline-flex items-center gap-1">
              <ShieldAlert size={11} aria-hidden="true" /> Redzone
            </span>
          </Badge>
        )}
        {isPlenaryCard && plenaryCode && (
          <Badge tone="sun">
            <span className="inline-flex items-center gap-1 font-mono">
              <IdCard size={11} aria-hidden="true" /> {plenaryCode}
            </span>
          </Badge>
        )}
        {checkedIn && person.checked_in_at && (
          <span className="text-[11px] font-semibold text-muted">
            In {formatDateTime(person.checked_in_at)}
          </span>
        )}
      </div>

      {showCheckIn && !checkedIn && !plenaryUnassigned && onCheckIn && (
        <div className="px-3.5 pb-3">
          <Button className="w-full" icon={CheckCircle2} disabled={busy} onClick={onCheckIn}>
            {offline ? 'Check in (queued offline)' : 'Check in'}
          </Button>
        </div>
      )}

      <footer className="bg-teal-dark px-3.5 py-3 text-center">
        <p className="m-0 text-[18px] font-black uppercase tracking-[0.14em] text-cream">
          {isPlenaryCard && plenaryCode ? plenaryCode : badgeType}
        </p>
      </footer>

      <PersonBadgeQrModal
        person={person}
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        payload={qrPayload}
      />
    </article>
  )
}

function Detail({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="m-0 flex items-center gap-1 truncate text-[13px] font-extrabold capitalize text-ink">
        {Icon && <Icon size={13} className="shrink-0 opacity-70" aria-hidden="true" />}
        {value}
      </dd>
    </div>
  )
}
