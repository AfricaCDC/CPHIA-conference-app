import Card from '../../components/ui/Card'
import PermissionCoachBanner from '../../components/PermissionCoachBanner'
import { LoadState } from '../../components/ui/LoadState'
import { Building2, CheckCircle2, MapPin, MapPinned, Navigation } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

/**
 * Venue desk: pick a venue, list rooms, set GPS pins + entrance notes (editors only).
 */
export default function VenueDeskScreen() {
  const slug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const { data, loading, error, reload } = useRemote(`/events/${encodeURIComponent(slug)}/venue-desk`)
  const payload = data?.data
  const venues = payload?.venues ?? []
  const kpis = payload?.kpis ?? {}
  const canEdit = Boolean(payload?.can_edit)
  const [venueId, setVenueId] = useState('')
  const [editing, setEditing] = useState(null)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!venueId && venues.length) {
      setVenueId(String(venues[0].id))
    }
  }, [venues, venueId])

  const venue = useMemo(
    () => venues.find((row) => String(row.id) === String(venueId)) ?? venues[0] ?? null,
    [venues, venueId],
  )
  const halls = venue?.halls ?? []

  function openEdit(hall) {
    setEditing(hall)
    setLat(hall.latitude != null ? String(hall.latitude) : '')
    setLng(hall.longitude != null ? String(hall.longitude) : '')
    setNotes(hall.entrance_notes || '')
  }

  async function useMyLocation() {
    const { readCurrentPosition, geolocationErrorMessage, geolocationSupported } = await import('../../lib/geolocation')
    if (!geolocationSupported()) {
      showToast('Location is not available on this device', 'info')
      return
    }
    setLocating(true)
    try {
      const pos = await readCurrentPosition()
      setLat(String(pos.latitude.toFixed(7)))
      setLng(String(pos.longitude.toFixed(7)))
      showToast('Location filled from your phone')
    } catch (err) {
      showToast(geolocationErrorMessage(err), 'info')
    } finally {
      setLocating(false)
    }
  }

  async function saveHall() {
    if (!editing) return
    setBusy(true)
    try {
      const body = {
        entrance_notes: notes.trim() || null,
        latitude: lat.trim() === '' ? null : Number(lat),
        longitude: lng.trim() === '' ? null : Number(lng),
      }
      await api(`/events/${encodeURIComponent(slug)}/venue-desk/halls/${editing.id}`, {
        method: 'PATCH',
        body,
      })
      showToast(`${editing.name} saved`)
      setEditing(null)
      reload()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(false)
    }
  }

  return (
    <LoadState loading={loading && !data} error={error} onRetry={reload}>
      <PermissionCoachBanner
        active={locating}
        title="Look at the TOP of the screen"
        detail="Tap Allow if a location prompt appears near the status bar. On installed Android apps it is often not centered."
      />
      <div className="kpi" aria-label="Venue rooms">
        <div><b>{kpis.venues ?? 0}</b><span>venues</span></div>
        <div><b>{kpis.rooms ?? 0}</b><span>rooms</span></div>
        <div><b>{kpis.missing_location ?? 0}</b><span>missing pin</span></div>
      </div>

      {venues.length > 0 && (
        <Card className="card">
          <label className="lab" htmlFor="venue-desk-venue">Venue</label>
          <select
            id="venue-desk-venue"
            className="mt-1 w-full rounded-full border-2 border-sun bg-white px-3.5 py-2.5 text-sm font-extrabold text-ink"
            value={venueId}
            onChange={(event) => setVenueId(event.target.value)}
          >
            {venues.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          {venue?.location && <span className="s mt-2">{venue.location}</span>}
        </Card>
      )}

      {!canEdit && (
        <Card className="card mint">
          <span className="t">View only</span>
          <span className="s">Room map pins are set by venue managers and admins. You can still browse rooms and see which have GPS.</span>
        </Card>
      )}

      {halls.length === 0 && <div className="empty">No rooms on this venue yet.</div>}

      <div className="flex flex-col gap-2.5">
        {halls.map((hall) => (
          <Card key={hall.id} className="card flex flex-col gap-2">
            <div className="row items-start">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${hall.has_map_pin ? 'bg-mint-soft text-teal' : 'bg-sun/30 text-ink'}`}>
                {hall.has_map_pin
                  ? <MapPinned size={18} aria-hidden="true" />
                  : <MapPin size={18} aria-hidden="true" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t">{hall.name}</span>
                <span className="s flex items-center gap-1.5">
                  <Building2 size={14} className="shrink-0 text-teal" aria-hidden="true" />
                  {[hall.building, hall.floor_label, hall.room_number].filter(Boolean).join(' · ') || 'Room'}
                </span>
                {hall.entrance_notes && <span className="s">{hall.entrance_notes}</span>}
              </div>
              <span className={`pill ${hall.has_map_pin ? 't' : 'y'}`}>
                {hall.has_map_pin ? 'Pinned' : 'No pin'}
              </span>
            </div>
            {canEdit && (
              <button type="button" className="btn o" onClick={() => openEdit(hall)}>
                {hall.has_map_pin ? 'Edit pin & notes' : 'Set coordinates'}
              </button>
            )}
          </Card>
        ))}
      </div>

      {editing && (
        <Card className="card sticky bottom-2 z-10 shadow-lg">
          <span className="lab">Room pin</span>
          <span className="t">{editing.name}</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="s">Latitude</span>
              <input
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
                inputMode="decimal"
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                placeholder="9.0108"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="s">Longitude</span>
              <input
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
                inputMode="decimal"
                value={lng}
                onChange={(event) => setLng(event.target.value)}
                placeholder="38.7613"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="s">Entrance notes</span>
            <textarea
              className="min-h-[72px] rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="How to find the door"
            />
          </label>
          <button type="button" className="btn o" onClick={useMyLocation} disabled={locating}>
            <Navigation size={16} aria-hidden="true" /> {locating ? 'Waiting for Allow…' : 'Use my location'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button type="button" className="btn y" onClick={saveHall} disabled={busy}>
              <CheckCircle2 size={16} aria-hidden="true" />
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Card>
      )}
    </LoadState>
  )
}
