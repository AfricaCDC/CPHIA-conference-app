import Card from '../../components/ui/Card'
import { Chips } from '../../components/ui/ScreenHeader'
import { BedDouble, CheckCircle2, MapPin } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Avatar from '../../components/ui/Avatar'
import { LoadState } from '../../components/ui/LoadState'
import { api } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'arriving', label: 'To check in' },
  { id: 'in', label: 'Checked in' },
  { id: 'leaving', label: 'Leaving today' },
]

/**
 * Hotel lobby desk: Africa CDC–sponsored guests in hotels marked Used by Africa CDC.
 * Bound ushers see assigned hotels only; managers/admins see all CDC hotels.
 */
export default function HotelDeskScreen() {
  const slug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const [hotelId, setHotelId] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const qs = hotelId ? `?hotel_id=${encodeURIComponent(hotelId)}` : ''
  const { data, loading, error, reload } = useRemote(`/events/${encodeURIComponent(slug)}/transport-desk/hotel${qs}`)
  const payload = data?.data
  const rows = payload?.rows ?? []
  const hotels = payload?.hotels ?? []
  const kpis = payload?.kpis ?? {}
  const canSwitchHotels = Boolean(payload?.can_switch_hotels)
  const [busy, setBusy] = useState(null)
  const multiHotel = hotels.length > 1

  useEffect(() => {
    if (payload?.hotel_id && !hotelId) {
      setHotelId(String(payload.hotel_id))
    }
  }, [payload?.hotel_id, hotelId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter === 'arriving' && row.status === 'checked_in') return false
      if (filter === 'in' && row.status !== 'checked_in') return false
      if (filter === 'leaving' && !row.leaving_today) return false
      if (!q) return true
      const hay = [row.title, row.detail, row.hotel_name, row.room].map((v) => String(v || '').toLowerCase()).join(' ')
      return q.split(/\s+/).every((token) => hay.includes(token))
    })
  }, [rows, query, filter])

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
      {hotels.length > 0 && (
        <Card className="card">
          <label className="lab" htmlFor="hotel-desk-hotel">Hotel</label>
          {multiHotel ? (
            <select
              id="hotel-desk-hotel"
              className="mt-1 w-full rounded-full border-2 border-sun bg-white px-3.5 py-2.5 text-sm font-extrabold text-ink"
              value={hotelId}
              onChange={(event) => setHotelId(event.target.value)}
            >
              {(canSwitchHotels || multiHotel) && <option value="">All Africa CDC hotels</option>}
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
              ))}
            </select>
          ) : (
            <p id="hotel-desk-hotel" className="mt-1 flex items-center gap-2 rounded-full border-2 border-sun bg-white px-3.5 py-2.5 text-sm font-extrabold text-ink">
              <BedDouble size={16} className="text-teal" aria-hidden="true" />
              {hotels[0]?.name}
            </p>
          )}
          {multiHotel && (
            <span className="s mt-2">Only hotels marked Used by Africa CDC. Guests are Africa CDC–sponsored with accommodation.</span>
          )}
        </Card>
      )}

      <div className="kpi" aria-label="Hotel desk today">
        <div><b>{kpis.guests ?? 0}</b><span>guests</span></div>
        <div><b>{kpis.arriving_today ?? 0}</b><span>arriving today</span></div>
        <div><b>{kpis.checked_in ?? 0}</b><span>checked in</span></div>
      </div>

      <label className="sr-only" htmlFor="hotel-desk-search">Search guests</label>
      <input
        id="hotel-desk-search"
        type="search"
        className="w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink"
        placeholder="Search a guest"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <Chips label="Guest filter" options={FILTERS} value={filter} onChange={setFilter} light />

      {visible.length === 0 && (
        <div className="empty">
          {rows.length === 0
            ? 'No Africa CDC guests with accommodation at this hotel yet.'
            : 'No guests match this filter.'}
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {visible.map((row) => (
          <GuestCard key={row.id} row={row} busy={busy} onCheckIn={checkIn} />
        ))}
      </div>
    </LoadState>
  )
}

function guestSubtitle(row) {
  if (row.status === 'checked_in') {
    return [row.hotel_name, row.room, row.checked_in_by ? `Checked in by ${row.checked_in_by}` : 'Checked in']
      .filter(Boolean)
      .join(' · ')
  }
  return [row.hotel_name, 'confirm check-in'].filter(Boolean).join(' · ')
}

function GuestCard({ row, busy, onCheckIn }) {
  return (
    <Card className="card flex flex-col gap-2">
      <div className="row items-start">
        <Avatar name={row.title} size="sm" shape="square" className="!bg-mint-soft !text-teal" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="t">{row.title}</span>
          <span className="s flex items-center gap-1.5">
            {row.status === 'checked_in'
              ? <CheckCircle2 size={14} className="shrink-0 text-teal" aria-hidden="true" />
              : <MapPin size={14} className="shrink-0 text-teal" aria-hidden="true" />}
            {guestSubtitle(row)}
          </span>
        </div>
        {row.status === 'checked_in' && <span className="pill t">Checked in</span>}
        {row.arriving_today && row.status !== 'checked_in' && <span className="pill y">Arriving today</span>}
      </div>
      {row.status !== 'checked_in' && (
        <button type="button" className="btn y" disabled={busy === row.id} onClick={() => onCheckIn(row)}>
          <CheckCircle2 size={18} aria-hidden="true" />
          {busy === row.id ? 'Saving…' : 'Checked in'}
        </button>
      )}
    </Card>
  )
}
