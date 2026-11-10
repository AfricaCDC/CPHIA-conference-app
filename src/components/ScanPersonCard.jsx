import { Car, CheckCircle2, CloudOff, DoorOpen, IdCard, ShieldAlert } from 'lucide-react'
import Avatar from './ui/Avatar'
import Badge from './ui/Badge'
import Button from './ui/Button'
import { formatDateTime } from '../lib/format'

/** Staff scan result: photo + identity + access, styled like the printed badge card. */
export default function ScanPersonCard({
  person,
  busy = false,
  onCheckIn,
  showCheckIn = true,
}) {
  if (!person) return null

  const badgeType = person.delegate_type || person.badge_type_label || person.badge_type || 'Delegate'
  const checkedIn = Boolean(person.checked_in_at || person.checked_in)
  const offline = Boolean(person.offline_cached)

  return (
    <article className="scan-person overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex gap-3 p-3.5">
        <Avatar name={person.name} photoUrl={person.photo_url} size="xl" shape="square" className="size-[88px] text-2xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={checkedIn ? 'teal' : 'sun'}>{checkedIn ? 'Checked in' : 'Not checked in'}</Badge>
            {offline && (
              <Badge tone="maroon">
                <span className="inline-flex items-center gap-1">
                  <CloudOff size={11} aria-hidden="true" /> Offline
                </span>
              </Badge>
            )}
          </div>
          <h2 className="m-0 text-[15px] font-black uppercase leading-tight tracking-wide text-ink">
            {person.name}
          </h2>
          {(person.organization || person.category) && (
            <p className="m-0 text-[12px] leading-snug text-muted">
              <span className="font-bold text-ink/70">Con/Org.</span>{' '}
              {[person.organization, person.category].filter(Boolean).join(' · ')}
            </p>
          )}
          {person.email && <p className="m-0 truncate text-[11px] text-muted">{person.email}</p>}
        </div>
      </div>

      <dl className="mx-3.5 mb-3 grid grid-cols-2 gap-2 rounded-xl bg-mint-soft/60 p-2.5">
        <Detail label="Status" value={person.status ? String(person.status).replace(/_/g, ' ') : '—'} />
        <Detail
          label="Badge ID"
          value={person.badge_id != null ? String(person.badge_id) : '—'}
          icon={IdCard}
        />
        <Detail
          label="Batch"
          value={(person.batch_number ?? person.badge_box_batch) != null
            ? String(person.batch_number ?? person.badge_box_batch)
            : '—'}
        />
        <Detail
          label="Box"
          value={(person.box_number ?? person.badge_packing_list) != null
            ? String(person.box_number ?? person.badge_packing_list)
            : '—'}
        />
      </dl>

      <div className="mx-3.5 mb-3 flex flex-wrap gap-1.5">
        {(person.has_plenary_access || person.plenary_access) && (
          <Badge tone="teal">
            <span className="inline-flex items-center gap-1">
              <DoorOpen size={11} aria-hidden="true" /> Plenary
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
        {person.has_redzone_plenary_access && (
          <Badge tone="maroon">
            <span className="inline-flex items-center gap-1">
              <ShieldAlert size={11} aria-hidden="true" /> Redzone
            </span>
          </Badge>
        )}
        {checkedIn && person.checked_in_at && (
          <span className="text-[11px] font-semibold text-muted">
            In {formatDateTime(person.checked_in_at)}
          </span>
        )}
      </div>

      {showCheckIn && !checkedIn && onCheckIn && (
        <div className="px-3.5 pb-3">
          <Button className="w-full" icon={CheckCircle2} disabled={busy} onClick={onCheckIn}>
            {offline ? 'Check in (queued offline)' : 'Check in'}
          </Button>
        </div>
      )}

      <footer className="bg-teal-dark px-3.5 py-3 text-center">
        <p className="m-0 text-[18px] font-black uppercase tracking-[0.14em] text-cream">
          {badgeType}
        </p>
      </footer>
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
