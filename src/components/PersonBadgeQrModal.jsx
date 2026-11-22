import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { QrCode, X } from 'lucide-react'
import Badge from './ui/Badge'
import BadgeQr from './BadgeQr'
import { api } from '../lib/api'
import { useEventSlug } from '../lib/useParticipant'
import { useAppStore } from '../store/appStore'

/**
 * Identify-only participant QR. Opens immediately when `qr_payload` is present;
 * otherwise loads Find-person detail once. Never sends to print.
 */
export function usePersonBadgeQr(person) {
  const slug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [payload, setPayload] = useState(() => (
    typeof person?.qr_payload === 'string' ? person.qr_payload.trim() : ''
  ))

  useEffect(() => {
    setOpen(false)
    setPayload(typeof person?.qr_payload === 'string' ? person.qr_payload.trim() : '')
  }, [person?.id, person?.qr_payload])

  async function openQr() {
    if (!person?.id && !payload) {
      showToast('QR not available for this person', 'info')
      return
    }
    if (payload) {
      setOpen(true)
      return
    }
    if (!person?.id) return
    setBusy(true)
    try {
      const { data } = await api(`/events/${encodeURIComponent(slug)}/participants/${person.id}`)
      const next = typeof data?.qr_payload === 'string' ? data.qr_payload.trim() : ''
      if (!next) {
        showToast('QR not available — missing receipt token', 'info')
        return
      }
      setPayload(next)
      setOpen(true)
    } catch (err) {
      showToast(err.message || 'Could not load QR', 'info')
    } finally {
      setBusy(false)
    }
  }

  return { open, setOpen, busy, payload, openQr }
}

/** Full-screen identify-only QR dialog (portaled to body so list transforms cannot clip it). */
export default function PersonBadgeQrModal({
  person,
  open,
  onClose,
  payload,
}) {
  const titleId = useId()
  const qr = (payload || '').trim()
  const badgeType = person?.delegate_type || person?.badge_type_label || person?.badge_type || 'Delegate'
  const displayName = person?.name || 'Participant'
  const printLabel = person?.print_status_label
    || (person?.print_status === 'printed' ? 'Printed'
      : person?.print_status === 'pending_print' ? 'Pending print'
        : person?.badge_print_active ? 'Printed' : null)
  const meta = [
    badgeType,
    person?.badge_id != null && `Badge ${person.badge_id}`,
    (person?.box_number ?? person?.badge_packing_list) != null && `Box ${person.box_number ?? person.badge_packing_list}`,
  ].filter(Boolean).join(' · ')

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || !qr || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p id={titleId} className="m-0 truncate text-[16px] font-black uppercase tracking-wide text-ink">
            {displayName}
          </p>
          {meta && (
            <p className="m-0 mt-0.5 text-[12px] text-muted">{meta}</p>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full p-2 text-muted hover:bg-mint-soft hover:text-ink"
          aria-label="Close QR"
          onClick={() => onClose?.()}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-8">
        <BadgeQr value={qr} size={280} title={`${displayName} badge QR`} />
        {printLabel && (
          <Badge tone={person?.print_status === 'printed' || person?.badge_print_active ? 'teal' : 'sun'}>
            {printLabel}
          </Badge>
        )}
        <p className="m-0 max-w-xs text-center text-[13px] text-muted">
          For identification only — this does not send the badge to print.
        </p>
      </div>
      <div className="border-t border-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button type="button" className="btn y w-full" onClick={() => onClose?.()}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** Clickable name that opens the identify-only QR modal (loads detail if needed). */
export function PersonNameQrButton({ person, className = '', children }) {
  const { open, setOpen, busy, payload, openQr } = usePersonBadgeQr(person)
  return (
    <>
      <button
        type="button"
        className={className || 'm-0 w-fit max-w-full truncate text-left text-[15px] font-bold text-ink underline decoration-teal/40 underline-offset-2 hover:text-teal'}
        onClick={(event) => {
          event.stopPropagation()
          openQr()
        }}
        disabled={busy}
        aria-haspopup="dialog"
      >
        {busy ? 'Loading QR…' : (children || person?.name || 'Participant')}
      </button>
      <PersonBadgeQrModal
        person={person}
        open={open}
        onClose={() => setOpen(false)}
        payload={payload}
      />
    </>
  )
}

export function PersonViewQrChip({ person, className = '' }) {
  const { open, setOpen, busy, payload, openQr } = usePersonBadgeQr(person)
  return (
    <>
      <button
        type="button"
        className={className || 'inline-flex w-fit items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-bold text-teal'}
        onClick={(event) => {
          event.stopPropagation()
          openQr()
        }}
        disabled={busy}
      >
        <QrCode size={12} aria-hidden="true" />
        {busy ? 'Loading…' : 'View QR'}
      </button>
      <PersonBadgeQrModal
        person={person}
        open={open}
        onClose={() => setOpen(false)}
        payload={payload}
      />
    </>
  )
}
