import Card from '../../components/ui/Card'
import { Chips } from '../../components/ui/ScreenHeader'
import { useEffect, useMemo, useState } from 'react'
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
 * Accommodation managers, hotel assistants and admins can switch hotel; ushers see assigned hotels.
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

  const arriving = useMemo(
    () => rows.filter((row) => row.arriving_today && row.status !== 'checked_in'),
    [rows],
  )

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
          {canSwitchHotels || hotels.length > 1 ? (
            <select
              id="hotel-desk-hotel"
              className="mt-1 w-full rounded-full border-2 border-sun bg-white px-3.5 py-2.5 text-sm font-extrabold text-ink"
              value={hotelId}
              onChange={(event) => setHotelId(event.target.value)}
            >
              {hotels.length > 1 && <option value="">All Africa CDC hotels</option>}
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
              ))}
            </select>
          ) : (
            <p id="hotel-desk-hotel" className="mt-1 rounded-full border-2 border-sun bg-white px-3.5 py-2.5 text-sm font-extrabold text-ink">
              {hotels[0]?.name}
            </p>
          )}
          <span className="s mt-2">Only hotels marked Used by Africa CDC. Guests are Africa CDC–sponsored with accommodation.</span>
        </Card>
      )}

      <div className="kpi" aria-label="Hotel desk today">
        <div><b>{kpis.guests ?? 0}</b><span>guests</span></div>
        <div><b>{kpis.arriving_today ?? 0}</b><span>arriving today</span></div>
        <div><b>{kpis.checked_in ?? 0}</b><span>checked in</span></div>
      </div>

      {arriving.length > 0 && filter === 'all' && !query.trim() && (
        <section className="flex flex-col gap-2" aria-label="Arriving today">
          <p className="lab">Arriving today · {arriving.length}</p>
          <div className="flex flex-col gap-2">
            {arriving.map((row) => (
              <GuestCard key={`arrive-${row.id}`} row={row} busy={busy} onCheckIn={checkIn} />
            ))}
          </div>
        </section>
      )}

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
  const hotel = row.hotel_name || null
  return [hotel, 'confirm check-in'].filter(Boolean).join(' · ')
}

function GuestCard({ row, busy, onCheckIn }) {
  return (
    <Card className="card flex flex-col gap-2">
      <div className="row">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="t">{row.title}</span>
          <span className="s">{guestSubtitle(row)}</span>
        </div>
        {row.status === 'checked_in' && <span className="pill t">Checked in</span>}
        {row.arriving_today && row.status !== 'checked_in' && <span className="pill y">Arriving today</span>}
      </div>
      {row.status !== 'checked_in' && (
        <button type="button" className="btn y" disabled={busy === row.id} onClick={() => onCheckIn(row)}>
          {busy === row.id ? 'Saving…' : 'Checked in'}
        </button>
      )}
    </Card>
  )
}
