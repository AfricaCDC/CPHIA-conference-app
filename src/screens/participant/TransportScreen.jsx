import ListRow from '../../components/ui/ListRow'
import { useEffect, useState } from 'react'
import { LocateFixed, MapPinned } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

const MOBILITY = [
  ['none', 'No mobility needs'],
  ['walking_aid', 'Walking aid'],
  ['wheelchair_foldable', 'Wheelchair (foldable)'],
  ['wheelchair_non_foldable', 'Wheelchair (not foldable)'],
]

/** Waiting is limited to hotel / airport / venue to avoid spam from other landmarks. */
const WAIT_PLACES = [
  { id: 'hotel', label: 'Hotel' },
  { id: 'airport', label: 'Airport' },
  { id: 'venue', label: 'Venue' },
]
const WAIT_KIND_SET = new Set(WAIT_PLACES.map((p) => p.id))
const waitAllowed = (stop) => stop?.wait_allowed === true || WAIT_KIND_SET.has(String(stop?.kind ?? '').toLowerCase())

/** Distance in metres between two {lat, lng} points. */
function metresBetween(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(h))
}

const distanceLabel = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`)
const NEAR_ROUTE_M = 20000

/** Flat list of wait-allowed stops across routes (deduped by stop id). */
function waitStops(routes) {
  const seen = new Set()
  const list = []
  for (const route of routes) {
    for (const stop of route.stops ?? []) {
      if (!waitAllowed(stop) || seen.has(stop.id)) continue
      seen.add(stop.id)
      list.push({ route, stop, kind: String(stop.kind ?? 'other').toLowerCase() })
    }
  }
  return list
}

/** The wait-allowed stop closest to the delegate. */
function nearestStop(routes, here) {
  let best = null
  for (const entry of waitStops(routes)) {
    const { route, stop } = entry
    if (stop.lat == null || stop.lng == null) continue
    const distance = metresBetween(here, stop)
    if (!best || distance < best.distance) best = { route, stop, distance, kind: entry.kind }
  }
  return best
}

/** Route line and stops drawn from the route's coordinates, with the chosen stop and the delegate marked. */
function RouteMap({ route, stopId, tag, here }) {
  const routePoints = (route?.path?.length ? route.path : route?.stops ?? []).filter((p) => p.lat != null && p.lng != null)
  const showHere = here && routePoints.some((p) => metresBetween(here, p) < NEAR_ROUTE_M)
  const points = showHere ? [...routePoints, here] : routePoints
  const W = 350
  const H = 170
  const pad = 24
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const x = (lng) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - pad * 2)
  const y = (lat) => H - pad - ((lat - minLat) / (maxLat - minLat || 1)) * (H - pad * 2)
  const line = routePoints.map((p) => `${x(p.lng)},${y(p.lat)}`).join(' ')
  const stops = (route?.stops ?? []).filter((s) => s.lat != null && s.lng != null)

  return (
    <div className="relative h-[170px] overflow-hidden rounded-[14px] bg-mint-soft" aria-label={route ? `Map of ${route.name}` : 'Shuttle map'} role="img">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" fill="none" aria-hidden="true">
        <path d="M0 60h350M0 120h350M90 0v170M210 0v170" className="stroke-pale" strokeWidth="3" />
        {routePoints.length > 1 && <polyline points={line} className="stroke-teal" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}
        {routePoints.length > 1 && stops.map((s) => (
          <circle key={s.id} cx={x(s.lng)} cy={y(s.lat)} r={s.id === stopId ? 8 : 5} className={`${s.id === stopId ? 'fill-sun' : 'fill-white'} stroke-ink`} strokeWidth="3" />
        ))}
        {showHere && (
          <g>
            <circle cx={x(here.lng)} cy={y(here.lat)} r="14" className="fill-teal-dark" opacity="0.2" />
            <circle cx={x(here.lng)} cy={y(here.lat)} r="6" className="fill-teal-dark stroke-white" strokeWidth="2" />
          </g>
        )}
      </svg>
      {showHere && <span className="absolute left-2.5 top-2.5 rounded-full bg-teal-dark px-2 py-1 text-[11px] font-extrabold text-cream">● You are here</span>}
      {tag && <span className="absolute right-2.5 top-2.5 rounded-full bg-ink px-2 py-1 text-[11px] font-extrabold text-cream">{tag}</span>}
      <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white px-2 py-1 text-[11px] font-semibold">Hotel and shuttle buses only</span>
    </div>
  )
}

function useCountdown(until) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!until) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [until])
  if (!until) return null
  const left = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000))
  return `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
}

/** Google Maps directions to a lat/lng (works on iOS/Android browsers). */
function mapsDirectionsUrl(lat, lng, label) {
  const dest = `${Number(lat)},${Number(lng)}`
  const query = label ? `${label} @ ${dest}` : dest
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=walking`
}

/** Collect named lat/lng points from journey legs so walk steps can open Maps too. */
function journeyMapPoints(legs) {
  const byName = new Map()
  for (const leg of legs ?? []) {
    for (const side of [leg.from, leg.to]) {
      const point = pointCoords(side)
      if (point?.name) byName.set(point.name, point)
    }
  }
  return byName
}

function pointCoords(point) {
  if (!point || typeof point !== 'object') return null
  const lat = point.lat ?? point.latitude
  const lng = point.lng ?? point.longitude
  if (lat == null || lng == null) return null
  return { lat: Number(lat), lng: Number(lng), name: point.name || null }
}

function formatClock(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return null
  }
}

/** FleetCOP proposed routes while the waiting signal is active. */
function WaitingJourneys({ journey }) {
  const options = Array.isArray(journey?.options) ? journey.options : []
  if (!journey || (options.length === 0 && !journey.message)) return null

  return (
    <Card data-tour="waiting-journeys">
      <span className="t">How to get there</span>
      <span className="s">
        {[journey.from, journey.to].filter(Boolean).join(' → ') || 'Proposed shuttle routes'}
        {journey.demo ? ' · demo times' : ''}
      </span>
      {journey.message && options.length === 0 && <span className="s">{journey.message}</span>}
      {options.map((option) => {
        const key = `${option.rank ?? ''}-${option.summary ?? ''}-${option.arriveAt ?? ''}`
        const arrive = formatClock(option.arriveAt)
        return (
          <div key={key} className="flex flex-col gap-2 border-t border-pale pt-3 first:border-0 first:pt-0">
            <div className="flex items-start justify-between gap-2">
              <span className="t">{option.summary || `Option ${option.rank ?? ''}`}</span>
              <span className="pill t shrink-0">
                {[option.totalMinutes != null && `${option.totalMinutes} min`, arrive && `arrive ${arrive}`].filter(Boolean).join(' · ') || 'Route'}
              </span>
            </div>
            <span className="s">
              {[
                option.walkMinutes != null && `${option.walkMinutes} min walk`,
                option.waitMinutes != null && `${option.waitMinutes} min wait`,
                option.rideMinutes != null && `${option.rideMinutes} min ride`,
                option.transfers != null && option.transfers > 0 && `${option.transfers} transfer${option.transfers === 1 ? '' : 's'}`,
              ].filter(Boolean).join(' · ')}
            </span>
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {(option.legs ?? []).map((leg, index) => {
                const points = journeyMapPoints(option.legs)
                const rideFrom = pointCoords(leg.from)
                const rideTo = pointCoords(leg.to)
                const shuttle = leg.nextShuttle
                const shuttleAt = formatClock(shuttle?.at)
                if (leg.type === 'ride') {
                  return (
                    <li key={`${key}-leg-${index}`} className="flex flex-col gap-1.5 rounded-[12px] bg-mint-soft px-3 py-2">
                      <span className="t text-xs">
                        Ride {leg.route?.code || leg.route?.name || 'shuttle'}
                        {leg.stops != null ? ` · ${leg.stops} stop${leg.stops === 1 ? '' : 's'}` : ''}
                      </span>
                      <span className="s">
                        {[rideFrom?.name || 'Board', rideTo?.name || 'Alight'].join(' → ')}
                        {shuttleAt ? ` · next ${shuttleAt}` : ''}
                        {shuttle?.minutes != null ? ` (in ${shuttle.minutes} min)` : ''}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {rideFrom && (
                          <a className="btn o sm" href={mapsDirectionsUrl(rideFrom.lat, rideFrom.lng, rideFrom.name)} target="_blank" rel="noreferrer">
                            <MapPinned size={14} aria-hidden="true" />Maps: {rideFrom.name || 'board'}
                          </a>
                        )}
                        {rideTo && (
                          <a className="btn o sm" href={mapsDirectionsUrl(rideTo.lat, rideTo.lng, rideTo.name)} target="_blank" rel="noreferrer">
                            <MapPinned size={14} aria-hidden="true" />Maps: {rideTo.name || 'alight'}
                          </a>
                        )}
                      </div>
                    </li>
                  )
                }
                const walkTo = typeof leg.to === 'string' ? points.get(leg.to) : pointCoords(leg.to)
                return (
                  <li key={`${key}-leg-${index}`} className="flex flex-col gap-1.5 rounded-[12px] px-1 py-1">
                    <span className="s">
                      Walk {leg.from || 'here'} → {leg.to || 'stop'}
                      {leg.minutes != null ? ` · ${leg.minutes} min` : ''}
                      {leg.meters != null ? ` · ${leg.meters} m` : ''}
                    </span>
                    {walkTo && (
                      <a className="btn o sm self-start" href={mapsDirectionsUrl(walkTo.lat, walkTo.lng, walkTo.name || leg.to)} target="_blank" rel="noreferrer">
                        <MapPinned size={14} aria-hidden="true" />Maps: {walkTo.name || leg.to}
                      </a>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        )
      })}
      {journey.note && <span className="s">{journey.note}</span>}
    </Card>
  )
}

function NeedsForm({ base, needs, onSaved }) {
  const showToast = useAppStore((state) => state.showToast)
  const [form, setForm] = useState({
    mobility: needs?.mobility ?? 'none',
    luggage_pieces: needs?.luggage_pieces ?? '',
    needs_boarding_assistance: Boolean(needs?.needs_boarding_assistance),
    notes: needs?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await api(`${base}/needs`, { method: 'PUT', body: { ...form, luggage_pieces: form.luggage_pieces === '' ? null : Number(form.luggage_pieces) } })
      showToast('Travel needs saved')
      onSaved()
    } catch (error) {
      showToast(error.message, 'info')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <span className="t">Travel needs</span>
      <span className="s">Transport Control uses these to send the right vehicle.</span>
      <label className="lab" htmlFor="mobility">Mobility</label>
      <select id="mobility" value={form.mobility} onChange={(e) => setForm({ ...form, mobility: e.target.value })}>
        {MOBILITY.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className="lab" htmlFor="luggage">Pieces of luggage</label>
      <input id="luggage" type="number" min="0" max="10" inputMode="numeric" value={form.luggage_pieces} onChange={(e) => setForm({ ...form, luggage_pieces: e.target.value })} />
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={form.needs_boarding_assistance} onChange={(e) => setForm({ ...form, needs_boarding_assistance: e.target.checked })} className="size-5 accent-teal-dark" />
        I need help boarding
      </label>
      <label className="lab" htmlFor="needs-notes">Anything else</label>
      <textarea id="needs-notes" rows="2" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <Button size="sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save travel needs'}</Button>
    </Card>
  )
}

/** Shuttles and rides, as in the wireframe: map, "I am waiting", timetable, travel needs. */
export default function TransportScreen() {
  const slug = useEventSlug()
  const base = `/events/${encodeURIComponent(slug)}/transport`
  const showToast = useAppStore((state) => state.showToast)
  const { data, loading, error, reload } = useRemote(base)
  const routes = (data?.routes ?? []).filter((route) => route.stops?.length)
  const waiting = data?.waiting
  const places = waitStops(routes)
  const [placeKind, setPlaceKind] = useState('hotel')
  const [stopId, setStopId] = useState(null)
  const [panel, setPanel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [here, setHere] = useState(null)
  const [locating, setLocating] = useState(false)
  const [nearest, setNearest] = useState(null)
  const [autoLocated, setAutoLocated] = useState(false)
  const countdown = useCountdown(waiting?.expires_at)

  const waitingEntry = waiting
    ? places.find((p) => p.stop.id === waiting.stop_id && p.route.id === waiting.route_id)
      ?? places.find((p) => p.stop.id === waiting.stop_id)
    : null
  const kindOptions = WAIT_PLACES.filter((place) => places.some((p) => p.kind === place.id))
  const activeKind = waitingEntry?.kind
    ?? (kindOptions.some((p) => p.id === placeKind) ? placeKind : kindOptions[0]?.id)
    ?? 'hotel'
  const kindStops = places.filter((p) => p.kind === activeKind)
  const selected = waitingEntry
    ?? kindStops.find((p) => p.stop.id === stopId)
    ?? kindStops[0]
    ?? null
  const route = selected?.route ?? routes.find((r) => r.id === waiting?.route_id) ?? routes[0]
  const stop = selected?.stop ?? null
  const nextVehicle = waiting?.next_vehicle
  const tag = waiting?.acknowledgement
    ? 'Control centre has seen you'
    : nextVehicle?.eta_text ? `${nextVehicle.plate ?? 'Bus'} · ${nextVehicle.eta_text}` : 'Where is my bus?'

  // A signal that ran out is gone on the server too; reload so the form comes back.
  useEffect(() => {
    if (countdown === '00:00') reload()
  }, [countdown, reload])

  function applyLocation(point, { silent = false } = {}) {
    const best = nearestStop(routes, point)
    setHere(point)
    if (!best) {
      if (!silent) showToast('No hotel, airport or venue stop has a location yet', 'info')
      return
    }
    setNearest(best)
    setPlaceKind(best.kind)
    setStopId(best.stop.id)
    if (!silent && best.distance > 2000) {
      showToast(`Nearest place is ${best.stop.name} (${distanceLabel(best.distance)}). Check before you send.`, 'info')
    }
  }

  function locate({ silent = false } = {}) {
    if (!navigator.geolocation) {
      if (!silent) showToast('This browser cannot share your location', 'info')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        applyLocation({ lat: coords.latitude, lng: coords.longitude }, { silent })
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        if (silent) return
        showToast(err.code === err.PERMISSION_DENIED ? 'Location is blocked. Allow it in your browser settings, or pick hotel, airport or venue below.' : 'Could not find your location. Pick hotel, airport or venue below.', 'info')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  // Estimate place once routes load so the select opens on hotel / airport / venue near the user.
  useEffect(() => {
    if (autoLocated || waiting || !places.length || !navigator.geolocation) return undefined
    setAutoLocated(true)
    locate({ silent: true })
    return undefined
  }, [autoLocated, waiting, places.length])

  async function run(action, message) {
    setBusy(true)
    try {
      await action()
      showToast(message)
      reload()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(false)
    }
  }

  const sendSignal = () => run(() => api(`${base}/wait`, {
    method: 'POST',
    body: {
      route_id: route.id,
      stop_id: stop.id,
      ...(here?.lat != null && here?.lng != null ? { lat: here.lat, lng: here.lng } : {}),
    },
  }), 'Control centre sees you waiting')
  const cancelSignal = () => run(() => api(`${base}/wait`, { method: 'DELETE' }), 'Waiting signal cancelled')

  return (
    <>
      <ScreenHeader kicker="Transport" title="Shuttles and rides" />
      <Body>
        <LoadState loading={loading && !data} error={error} onRetry={reload}>
          <RouteMap route={route} stopId={stop?.id} tag={tag} here={here} />

          <Card data-tour="waiting">
            <span className="t">I am waiting</span>
            <span className="s">Signal only from a hotel, the airport or the venue. The signal expires after 20 minutes.</span>
            {places.length === 0 ? (
              <span className="s">Hotel, airport and venue shuttle stops are published closer to the conference.</span>
            ) : (
              <>
                {!waiting && (
                  <button type="button" className="btn o sm" disabled={locating} onClick={() => locate()}>
                    <LocateFixed size={16} aria-hidden="true" />{locating ? 'Finding you…' : 'Use my location'}
                  </button>
                )}
                {nearest && !waiting && (
                  <span className="s" role="status">
                    Estimated place: <b>{nearest.stop.name}</b> ({WAIT_PLACES.find((p) => p.id === nearest.kind)?.label ?? nearest.kind}), {distanceLabel(nearest.distance)} away{nearest.distance > 2000 ? '. That is far; check before you send.' : '.'}
                  </span>
                )}
                <label className="lab" htmlFor="place">I am at</label>
                <select
                  id="place"
                  value={activeKind}
                  disabled={Boolean(waiting)}
                  onChange={(e) => {
                    setPlaceKind(e.target.value)
                    setStopId(null)
                  }}
                >
                  {kindOptions.map((place) => <option key={place.id} value={place.id}>{place.label}</option>)}
                </select>
                <label className="lab" htmlFor="stop">Exact stop</label>
                <select
                  id="stop"
                  value={stop?.id ?? ''}
                  disabled={Boolean(waiting) || kindStops.length === 0}
                  onChange={(e) => setStopId(Number(e.target.value))}
                >
                  {kindStops.map(({ stop: s, route: r }) => (
                    <option key={s.id} value={s.id}>{s.name}{r?.name ? ` · ${r.name}` : ''}</option>
                  ))}
                </select>
                {waiting ? (
                  <div className="btn justify-between text-sun" role="status">
                    <span>Signal sent · expires in {countdown ?? '20:00'}</span>
                    <button type="button" disabled={busy} onClick={cancelSignal} className="font-bold text-cream">Cancel</button>
                  </div>
                ) : (
                  <button type="button" className="btn y" disabled={busy || !stop} onClick={sendSignal}>Send my waiting signal</button>
                )}
              </>
            )}
          </Card>

          {waiting && <WaitingJourneys journey={waiting.journey} />}

          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" className="tile items-start text-left" aria-expanded={panel === 'timetable'} onClick={() => setPanel(panel === 'timetable' ? null : 'timetable')}>
              <span className="t">Shuttle timetable</span>
              <span className="s font-normal">{routes.length} route{routes.length === 1 ? '' : 's'}</span>
            </button>
            <button type="button" className="tile items-start text-left" aria-expanded={panel === 'needs'} onClick={() => setPanel(panel === 'needs' ? null : 'needs')}>
              <span className="t">Travel needs</span>
              <span className="s font-normal">{data?.needs?.declared ? data.needs.mobility_label : 'Mobility, luggage'}</span>
            </button>
          </div>

          {panel === 'timetable' && (
            <Card>
              <span className="t">Shuttle timetable</span>
              <div>
                {routes.map((r) => {
                  const times = (r.timetable ?? []).map((t) => (typeof t === 'string' ? t : t.time ?? t.departure ?? t.departs_at ?? '')).filter(Boolean)
                  const hours = [r.service_hours?.first_departure, r.service_hours?.last_departure].filter(Boolean).join(' to ')
                  return (
                    <ListRow key={r.id}>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="t">{r.name}</span>
                        <span className="s">{[r.frequency_minutes && `every ${r.frequency_minutes} min`, hours, times.slice(0, 6).join(' · ')].filter(Boolean).join(' · ') || r.description || 'Times to be published'}</span>
                      </span>
                    </ListRow>
                  )
                })}
              </div>
            </Card>
          )}
          {panel === 'needs' && <NeedsForm base={base} needs={data?.needs} onSaved={() => { setPanel(null); reload() }} />}

          {(data?.my_assignments ?? []).length > 0 && (
            <Card>
              <span className="t">My rides</span>
              {data.my_assignments.map((ride) => (
                <ListRow key={ride.id}>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="t">{[ride.pickup?.label ?? ride.pickup?.name, ride.dropoff?.label ?? ride.dropoff?.name].filter(Boolean).join(' → ') || ride.type_label}</span>
                    <span className="s">{[ride.type_label, ride.scheduled_at && formatDateTime(ride.scheduled_at), ride.pickup_status_label].filter(Boolean).join(' · ')}</span>
                  </span>
                  {ride.status_label && <span className="pill">{ride.status_label}</span>}
                </ListRow>
              ))}
            </Card>
          )}

          <Card tone="mint">
            <span className="t">VIP and official cars</span>
            <span className="s">Ministers and VIPs request a car through their protocol officer. Protocol cars are not shown on the map.</span>
          </Card>
          <Card>
            <span className="t">Airport desk</span>
            <span className="s">Meet the CPHIA desk after immigration on arrival. Your departure shuttle leaves from your hotel.</span>
            {data?.desk?.phone && <a className="btn o sm" href={`tel:${data.desk.phone}`}>Call {data.desk.label ?? 'the transport desk'}: {data.desk.phone}</a>}
          </Card>
        </LoadState>
      </Body>
    </>
  )
}
