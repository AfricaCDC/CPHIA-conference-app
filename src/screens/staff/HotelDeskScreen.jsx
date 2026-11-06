import Card from '../../components/ui/Card'
import { useEffect, useState } from 'react'
import { LoadState } from '../../components/ui/LoadState'
import { api } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

/**
 * Hotel lobby desk: Africa CDC–sponsored guests in hotels marked Used by Africa CDC.
 * Accommodation managers and admins can switch hotel; hotel accounts only see their own.
 */
export default function HotelDeskScreen() {
  const slug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const [hotelId, setHotelId] = useState('')
  const qs = hotelId ? `?hotel_id=${encodeURIComponent(hotelId)}` : ''
  const { data, loading, error, reload } = useRemote(`/events/${encodeURIComponent(slug)}/transport-desk/hotel${qs}`)
  const payload = data?.data
  const rows = payload?.rows ?? []
  const hotels = payload?.hotels ?? []
  const kpis = payload?.kpis ?? {}
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (payload?.hotel_id && !hotelId) {
      setHotelId(String(payload.hotel_id))
    }
  }, [payload?.hotel_id, hotelId])

  async function checkIn(row) {
    setBusy(row.id)
    try {
      await api(`/events/${encodeURIComponent(slug)}/transport-desk/guests/${row.id}/check-in`, { method: 'POST', body: {} })
      showToast(`${row.title} checked in`)
      reload()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(null)
    }
  }

  return (
    <LoadState loading={loading && !data} error={error} onRetry={reload}>
      {payload?.can_switch_hotels && hotels.length > 0 && (
        <Card className="card">
          <label className="lab" htmlFor="hotel-desk-hotel">Hotel</label>
          <select
            id="hotel-desk-hotel"
            className="mt-1 w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm font-bold text-ink"
            value={hotelId}
            onChange={(event) => setHotelId(event.target.value)}
          >
            {hotels.length > 1 && <option value="">All Africa CDC hotels</option>}
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
            ))}
          </select>
          <span className="s mt-2">Only hotels marked Used by Africa CDC. Guests are Africa CDC–sponsored with accommodation.</span>
        </Card>
      )}

      <div className="kpi">
        <div><b>{kpis.guests ?? 0}</b><span>guests</span></div>
        <div><b>{kpis.arriving_today ?? 0}</b><span>arriving today</span></div>
        <div><b>{kpis.checked_in ?? 0}</b><span>checked in</span></div>
      </div>

      {rows.length === 0 && <div className="empty">No Africa CDC guests with accommodation at this hotel yet.</div>}
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <Card key={row.id} className="card flex flex-col gap-2">
            <div className="row">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t">{row.title}</span>
                {row.detail && <span className="s">{row.detail}</span>}
                {row.checked_in_by && <span className="s">Checked in by {row.checked_in_by}</span>}
              </div>
              {row.status && <span className="pill t">Checked in</span>}
            </div>
            {row.status !== 'checked_in' && (
              <button type="button" className="btn y sm" disabled={busy === row.id} onClick={() => checkIn(row)}>
                Checked in
              </button>
            )}
          </Card>
        ))}
      </div>
    </LoadState>
  )
}
