import Card from '../../components/ui/Card'
import { useState } from 'react'
import { LoadState } from '../../components/ui/LoadState'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

/** VIP movements arriving: officers take one on, and the manager is told. Same list as the movements page. */
export default function ProtocolMovementsScreen() {
  const slug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const { data, loading, error, reload } = useRemote(`/events/${encodeURIComponent(slug)}/protocol/movements`)
  const rows = data?.data?.rows ?? []
  const [busy, setBusy] = useState(null)

  async function take(row) {
    setBusy(row.id)
    try {
      await api(`/events/${encodeURIComponent(slug)}/protocol/movements/${row.id}/take`, { method: 'POST', body: {} })
      showToast(`You took on ${row.title}`)
      reload()
    } catch (err) {
      showToast(err.message, 'info')
      reload()
    } finally {
      setBusy(null)
    }
  }

  return (
    <LoadState loading={loading && !data} error={error} onRetry={reload}>
      {rows.length === 0 && <div className="empty">No VIP movements yet.</div>}
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <Card key={row.id} className="card flex flex-col gap-2">
            <div className="row">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t">{row.title}</span>
                <span className="s">{[formatDateTime(row.when), row.route].filter(Boolean).join(' · ')}</span>
                {row.officer && <span className="s">Officer: {row.officer}</span>}
              </div>
              {row.mine ? <span className="pill t">Yours</span> : row.open ? <span className="pill y">Open</span> : null}
            </div>
            {row.open && (
              <button type="button" className="btn y sm" disabled={busy === row.id} onClick={() => take(row)}>Take on</button>
            )}
          </Card>
        ))}
      </div>
    </LoadState>
  )
}
