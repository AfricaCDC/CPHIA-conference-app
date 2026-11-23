import { useMemo, useState } from 'react'
import Button from './ui/Button'
import Card from './ui/Card'
import { api } from '../lib/api'
import { useAppStore } from '../store/appStore'

/**
 * SAM-style badge desk actions for the PWA: issue, send for print, badge type, reprint.
 */
export default function BadgeDeskActions({
  person,
  slug,
  busy = false,
  onUpdated,
  onIssue,
}) {
  const showToast = useAppStore((state) => state.showToast)
  const [working, setWorking] = useState(null)
  const [badgeType, setBadgeType] = useState(person?.badge_type_value || 'delegate')
  const [reason, setReason] = useState('')

  const types = useMemo(() => {
    const list = Array.isArray(person?.badge_types) ? person.badge_types : []
    return list.length
      ? list
      : [
          { value: 'delegate', label: 'Delegate (Badge)' },
          { value: 'exhibitor', label: 'Exhibitor (Badge)' },
          { value: 'vip', label: 'VIP (Pin and Badge)' },
          { value: 'ambassador', label: 'Ambassador (Badge)' },
        ]
  }, [person?.badge_types])

  const base = `/events/${encodeURIComponent(slug)}/badge-desk/registrations/${person?.id}`
  const disabled = busy || working !== null || !person?.id

  async function run(action, request) {
    setWorking(action)
    try {
      const payload = await request()
      const next = payload?.data || payload
      if (next && typeof next === 'object') {
        onUpdated?.(next)
        if (next.badge_type_value) setBadgeType(next.badge_type_value)
      }
      showToast(payload?.message || 'Done', 'success')
    } catch (err) {
      showToast(err?.message || 'Action failed', 'error')
    } finally {
      setWorking(null)
    }
  }

  if (!person?.id) return null

  return (
    <Card className="flex flex-col gap-2">
      <span className="t">Badge desk actions</span>
      {(person.badge_id == null || person.badge_id === '') && (
        <span className="s">No packing badge ID yet — scan/issue will assign one from registration #{person.id}.</span>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold text-muted">Badge type</span>
        <select
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[14px]"
          value={badgeType}
          disabled={disabled}
          onChange={(e) => setBadgeType(e.target.value)}
        >
          {types.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label || type.value}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold text-muted">Reason (reprint / type change)</span>
        <input
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[14px]"
          value={reason}
          disabled={disabled}
          placeholder="Optional for type · required for reprint"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      {person.can_issue && (
        <Button
          className="w-full"
          variant="accent"
          disabled={disabled}
          onClick={() => (onIssue ? onIssue(person) : run('issue', () => api(`${base}/issue`, { method: 'POST', body: {} })))}
        >
          {working === 'issue' ? 'Issuing…' : person.badge_issued_at ? 'Re-issue badge' : 'Issue badge'}
        </Button>
      )}

      {person.can_send_for_printing && (
        <Button
          className="w-full"
          variant="ghost"
          disabled={disabled || !badgeType}
          onClick={() => run('send', () => api(`${base}/send-for-printing`, {
            method: 'POST',
            body: { badge_type: badgeType },
          }))}
        >
          {working === 'send' ? 'Sending…' : 'Send for printing'}
        </Button>
      )}

      {person.can_change_badge_type && (
        <Button
          className="w-full"
          variant="ghost"
          disabled={disabled || !badgeType}
          onClick={() => run('type', () => api(`${base}/badge-type`, {
            method: 'POST',
            body: { badge_type: badgeType, reason: reason || 'Mobile badge desk' },
          }))}
        >
          {working === 'type' ? 'Saving…' : 'Change badge type'}
        </Button>
      )}

      {(person.can_request_reprint || person.can_reprint) && (
        <Button
          className="w-full"
          variant="ghost"
          disabled={disabled || !badgeType || !reason.trim()}
          onClick={() => run('reprint', () => api(`${base}/reprint`, {
            method: 'POST',
            body: { badge_type: badgeType, reason: reason.trim() },
          }))}
        >
          {working === 'reprint' ? 'Queueing…' : person.reprint_requested ? 'Update reprint queue' : 'Request reprint'}
        </Button>
      )}

      {!person.can_issue && person.issue_block && (
        <span className="s">{person.issue_block}</span>
      )}
      {person.reprint_requested && (
        <span className="s">Reprint already queued{person.reprint_requested_at ? ` · ${new Date(person.reprint_requested_at).toLocaleString()}` : ''}.</span>
      )}
    </Card>
  )
}
