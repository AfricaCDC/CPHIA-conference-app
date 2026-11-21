import ListRow from '../../components/ui/ListRow'
import { useEffect, useMemo, useState } from 'react'
import { BusFront, LocateFixed, MapPinned, Navigation, Search } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { mapEmbedUrl } from '../DirectionsScreen'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { geolocationErrorMessage, geolocationSupported, readCurrentPosition } from '../../lib/geolocation'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'
import { useBrandStore } from '../../store/brandStore'

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

/** Google / platform map of the pickup stop; navigate opens walking directions in Maps. */
function RouteMap({ route, stop, tag, here }) {
  const maps = useBrandStore((state) => state.maps)
  const provider = maps?.provider || 'google'
  const googleKey = maps?.googleKey || null

  const pickup = useMemo(() => {
    if (stop?.lat != null && stop?.lng != null) {
      return { lat: Number(stop.lat), lng: Number(stop.lng), name: stop.name || 'Pickup stop' }
    }
    const first = (route?.stops ?? []).find((s) => s.lat != null && s.lng != null)
    if (first) return { lat: Number(first.lat), lng: Number(first.lng), name: first.name || route?.name || 'Shuttle stop' }
    if (here?.lat != null && here?.lng != null) return { lat: Number(here.lat), lng: Number(here.lng), name: 'Your location' }
    return null
  }, [stop, route, here])

  const embedSrc = useMemo(() => {
    if (!pickup) return null
    // Walking directions from the delegate to the pickup when we have both points + a Google key.
    if (
      provider === 'google'
      && googleKey
      && here?.lat != null
      && here?.lng != null
      && pickup
      && metresBetween(here, pickup) < NEAR_ROUTE_M
    ) {
      return `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(googleKey)}&origin=${here.lat}%2C${here.lng}&destination=${pickup.lat}%2C${pickup.lng}&mode=walking&zoom=15`
    }
    return mapEmbedUrl(pickup.lat, pickup.lng, { provider, googleKey })
  }, [pickup, here, provider, googleKey])

  const navigateHref = pickup ? mapsDirectionsUrl(pickup.lat, pickup.lng, pickup.name) : null
  const nearPickup = here && pickup && metresBetween(here, pickup) < NEAR_ROUTE_M

  if (!pickup || !embedSrc) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-[14px] border border-line bg-mint-soft px-4 text-center">
        <span className="s">Pick a hotel, airport or venue stop to see it on the map.</span>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white">
      <div className="relative h-[220px]">
        <iframe
          title={route ? `Map of ${pickup.name} on ${route.name}` : `Map of ${pickup.name}`}
          src={embedSrc}
          className="absolute inset-0 size-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="geolocation; fullscreen"
        />
        {nearPickup && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-teal-dark px-2 py-1 text-[11px] font-extrabold text-cream">
            ● You are here
          </span>
        )}
        {tag && (
          <span className="pointer-events-none absolute right-2.5 top-2.5 max-w-[55%] truncate rounded-full bg-ink px-2 py-1 text-[11px] font-extrabold text-cream">
            {tag}
          </span>
        )}
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold shadow-sm">
          Hotel and shuttle buses only
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
        <span className="s min-w-0 flex-1 truncate">
          Pickup: <b className="text-ink">{pickup.name}</b>
        </span>
        <a className="btn o sm shrink-0" href={navigateHref} target="_blank" rel="noopener noreferrer">
          <Navigation size={14} aria-hidden="true" />
          Navigate to pickup
        </a>
      </div>
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
const KIND_LABEL = { hotel: 'Hotel', airport: 'Airport', venue: 'Venue', office: 'Office', other: 'Stop' }
const placeKey = (name) => String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Every named place on the shuttle network, once. The feed lists a place again on each route
 * (and each direction) that calls there; the copy with a map position is kept.
 */
function networkPlaces(routes) {
  const byName = new Map()
  for (const route of routes) {
    for (const stop of route.stops ?? []) {
      const key = placeKey(stop.name)
      if (!key) continue
      const kind = String(stop.kind ?? 'other').toLowerCase()
      const hasPosition = stop.lat != null && stop.lng != null
      const known = byName.get(key)
      if (!known) {
        byName.set(key, { key, stopId: stop.id, name: stop.name, kind, lat: stop.lat, lng: stop.lng, hasPosition, canWait: waitAllowed(stop), routes: 1 })
      } else {
        known.routes += 1
        known.canWait = known.canWait || waitAllowed(stop)
        if (!known.hasPosition && hasPosition) Object.assign(known, { stopId: stop.id, lat: stop.lat, lng: stop.lng, hasPosition: true })
      }
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** A search box over the network's places. Typing filters; tapping a result picks it. */
function PlacePicker({ id, label, places, value, onChange, placeholder, disabled }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const needle = query.trim().toLowerCase()
  const matches = useMemo(() => {
    const list = needle
      ? places.filter((place) => place.name.toLowerCase().includes(needle) || (KIND_LABEL[place.kind] ?? '').toLowerCase().includes(needle))
      : places
    return list.slice(0, 30)
  }, [places, needle])

  return (
    <div className="flex flex-col gap-1.5">
      <label className="lab" htmlFor={id}>{label}</label>
      <div className="relative">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          autoComplete="off"
          className="!pl-9"
          disabled={disabled}
          placeholder={value ? value.name : placeholder}
          value={open ? query : (value?.name ?? '')}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && !disabled && (
        <ul id={`${id}-list`} role="listbox" className="m-0 max-h-56 list-none overflow-y-auto rounded-[12px] border border-line bg-white p-1 shadow-sm">
          {matches.length === 0 && <li className="s px-3 py-2">No place matches “{query}”.</li>}
          {matches.map((place) => (
            <li key={place.key} role="option" aria-selected={value?.key === place.key}>
              <button
                type="button"
                className={`flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left ${value?.key === place.key ? 'bg-mint-soft' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(place); setOpen(false); setQuery('') }}
              >
                <span className="t min-w-0 truncate text-sm">{place.name}</span>
                <span className="pill shrink-0">{KIND_LABEL[place.kind] ?? 'Stop'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const rideLeg = (option) => (option?.legs ?? []).find((leg) => leg.type === 'ride') ?? null
const BASIS_LABEL = { live: 'live', timetable: 'timetable', frequency: 'usual frequency', demo: 'demo' }

/** "in 11 min · 15:38 (usual frequency)" for a FleetCOP next-shuttle block. */
function shuttleLabel(shuttle) {
  if (!shuttle) return 'time not published yet'
  const at = formatClock(shuttle.at)
  return [
    shuttle.minutes != null ? (shuttle.minutes <= 0 ? 'due now' : `in ${shuttle.minutes} min`) : null,
    at,
    shuttle.vehicle ? `bus ${shuttle.vehicle}` : null,
    shuttle.basis && BASIS_LABEL[shuttle.basis] ? `(${BASIS_LABEL[shuttle.basis]})` : null,
  ].filter(Boolean).join(' · ') || 'time not published yet'
}

/** Up to four proposed routes from where the delegate is to where they want to go. */
function BestRoutes({ plan, loading, error, selectedIndex, onSelect, onRetry, destination }) {
  const options = plan?.options ?? []
  return (
    <Card data-tour="best-routes">
      <span className="t">Best routes for you</span>
      <span className="s">
        {destination ? `From where you are to ${destination.name}.` : 'Choose where you want to go to see the best routes.'}
        {options.length > 0 ? ' Tap one to wait for it.' : ''}
      </span>
      {loading && <span className="s" role="status">Finding the best routes…</span>}
      {error && !loading && <button type="button" className="btn o sm" onClick={onRetry}>Could not load routes. Try again</button>}
      {!loading && !error && destination && options.length === 0 && <span className="s">{plan?.message ?? 'No shuttle route links these two places. Ask the transport desk.'}</span>}
      {options.map((option, index) => {
        const ride = rideLeg(option)
        const on = index === selectedIndex
        return (
          <button
            key={`${option.rank}-${option.summary}`}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(index)}
            className={`flex w-full flex-col gap-1 rounded-[12px] border px-3 py-2.5 text-left ${on ? 'border-teal-dark bg-mint-soft' : 'border-line bg-white'}`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="t text-sm">{index + 1}. {option.summary}{option.transfers > 0 ? ` · ${option.transfers} change` : ''}</span>
              <span className="pill t shrink-0">
                {option.totalMinutes != null ? `${option.totalMinutes} min` : `${(option.walkMinutes ?? 0) + (option.rideMinutes ?? 0)} min + wait`}
              </span>
            </span>
            {ride && <span className="s">{ride.route?.name ?? 'Shuttle'}</span>}
            <span className="s">
              Board at <b className="text-ink">{option.pickup?.name ?? ride?.from?.name ?? 'the nearest stop'}</b>
              {option.legs?.[0]?.type === 'walk' && option.legs[0].meters != null ? ` · ${distanceLabel(option.legs[0].meters)} walk` : ''}
            </span>
            <span className="s">Next shuttle: {shuttleLabel(ride?.nextShuttle)}</span>
          </button>
        )
      })}
    </Card>
  )
}

/** While waiting: the shuttles heading to the pickup stop. */
function ComingShuttles({ waiting, shuttles }) {
  const rows = []
  const next = waiting?.next_vehicle
  if (next) rows.push({ key: 'next', title: next.plate ?? 'Shuttle', detail: [next.route_name ?? waiting.route, next.eta_text].filter(Boolean).join(' · ') })
  for (const vehicle of shuttles ?? []) {
    if (vehicle.route_id !== waiting?.route_id || vehicle.plate === next?.plate) continue
    rows.push({ key: `live-${vehicle.trip_id ?? vehicle.plate}`, title: vehicle.plate ?? 'Shuttle', detail: [vehicle.route?.name, vehicle.eta_text ?? vehicle.status_label].filter(Boolean).join(' · ') })
  }
  for (const option of waiting?.journey?.options ?? []) {
    const ride = rideLeg(option)
    if (!ride) continue
    rows.push({
      key: `opt-${option.rank}-${option.summary}`,
      title: `${ride.route?.code ?? option.summary} · ${ride.route?.name ?? 'Shuttle'}`,
      detail: `Board at ${option.pickup?.name ?? ride.from?.name ?? 'your stop'} · next ${shuttleLabel(ride.nextShuttle)}`,
    })
  }
  if (rows.length === 0) return null

  return (
    <Card data-tour="coming-shuttles">
      <span className="t">Shuttles coming to you</span>
      <span className="s">At {waiting.stop}. Times come from the transport control centre.</span>
      <div>
        {rows.slice(0, 6).map((row) => (
          <ListRow key={row.key}>
            <BusFront size={18} aria-hidden="true" className="shrink-0 text-teal-dark" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="t text-sm">{row.title}</span>
              <span className="s">{row.detail}</span>
            </span>
          </ListRow>
        ))}
      </div>
    </Card>
  )
}

export default function TransportScreen() {
  const slug = useEventSlug()
  const base = `/events/${encodeURIComponent(slug)}/transport`
  const showToast = useAppStore((state) => state.showToast)
  const { data, loading, error, reload } = useRemote(base)
  const routes = useMemo(() => (data?.routes ?? []).filter((route) => route.stops?.length), [data])
  const waiting = data?.waiting
  const places = useMemo(() => networkPlaces(routes), [routes])
  const waitPlaces = useMemo(() => places.filter((place) => place.canWait && place.hasPosition), [places])
  const [panel, setPanel] = useState(null)
  const [busy, setBusy] = useState(false)
  // Where the delegate is: their phone's position, or a place they picked by hand.
  const [here, setHere] = useState(null)
  const [originPlace, setOriginPlace] = useState(null)
  const [pickOrigin, setPickOrigin] = useState(false)
  const [locating, setLocating] = useState(false)
  const [destination, setDestination] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [routeSearch, setRouteSearch] = useState('')
  const countdown = useCountdown(waiting?.expires_at)

  const origin = useMemo(
    () => here ?? (originPlace ? { lat: Number(originPlace.lat), lng: Number(originPlace.lng) } : null),
    [here, originPlace],
  )
  const nearest = useMemo(() => (here ? nearestStop(routes, here) : null), [routes, here])

  // "I am at" never decides where they are going. The venue is only a starting suggestion,
  // and not when they are already standing at it.
  useEffect(() => {
    if (destination || waiting || !origin || places.length === 0) return
    const venue = places.find((place) => place.kind === 'venue' && place.hasPosition)
    if (venue && metresBetween(origin, venue) > 600) setDestination(venue)
  }, [destination, waiting, origin, places])

  const journeysPath = origin && destination?.hasPosition && !waiting
    ? `${base}/journeys?lat=${origin.lat}&lng=${origin.lng}&to_stop_id=${destination.stopId}`
    : null
  const journeys = useRemote(journeysPath)
  const options = journeysPath ? (journeys.data?.options ?? []) : []
  useEffect(() => { setSelectedIndex(0) }, [journeysPath])
  const chosen = options[selectedIndex] ?? options[0] ?? null

  // Where to wait: the pickup stop of the chosen route, else the closest stop that takes signals.
  const fallbackPickup = nearest
    ? { route_id: nearest.route.id, stop_id: nearest.stop.id, name: nearest.stop.name, lat: nearest.stop.lat, lng: nearest.stop.lng }
    : originPlace
      ? (() => {
          const entry = waitStops(routes).find((item) => placeKey(item.stop.name) === originPlace.key)
          return entry ? { route_id: entry.route.id, stop_id: entry.stop.id, name: entry.stop.name, lat: entry.stop.lat, lng: entry.stop.lng } : null
        })()
      : null
  const pickup = chosen?.pickup?.wait_allowed ? chosen.pickup : fallbackPickup
  const waitingStop = waiting
    ? routes.flatMap((r) => r.stops ?? []).find((stop) => stop.id === waiting.stop_id) ?? null
    : null
  const mapStop = waiting ? waitingStop : pickup
  const mapRoute = routes.find((r) => r.id === (waiting?.route_id ?? pickup?.route_id)) ?? routes[0]
  const nextVehicle = waiting?.next_vehicle
  const tag = waiting?.acknowledgement
    ? 'Control centre has seen you'
    : nextVehicle?.eta_text
      ? `${nextVehicle.plate ?? 'Bus'} · ${nextVehicle.eta_text}`
      : waiting ? 'Waiting here' : pickup ? 'Best pickup' : 'Where is my bus?'

  // A signal that ran out is gone on the server too; reload so the form comes back.
  useEffect(() => {
    if (countdown === '00:00') reload()
  }, [countdown, reload])

  async function locate({ silent = false } = {}) {
    if (!geolocationSupported()) {
      if (!silent) showToast('This browser cannot share your location', 'info')
      return
    }
    setLocating(true)
    try {
      const coords = await readCurrentPosition()
      const point = { lat: coords.latitude, lng: coords.longitude }
      setHere(point)
      setOriginPlace(null)
      setPickOrigin(false)
      const best = nearestStop(routes, point)
      if (!silent && !best) showToast('No shuttle stop has a location yet', 'info')
      if (!silent && best && best.distance > 2000) {
        showToast(`The nearest stop is ${best.stop.name}, ${distanceLabel(best.distance)} away.`, 'info')
      }
    } catch (err) {
      if (!silent) {
        showToast(geolocationErrorMessage(err), 'info')
        setPickOrigin(true)
      }
    } finally {
      setLocating(false)
    }
  }

  // Android blocks a location prompt that no tap asked for. When the delegate has already
  // allowed location, read it at once; otherwise wait for "Use my location".
  const routeCount = routes.length
  useEffect(() => {
    if (here || waiting || routeCount === 0 || !navigator.permissions?.query) return
    navigator.permissions.query({ name: 'geolocation' })
      .then((status) => { if (status.state === 'granted') locate({ silent: true }) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCount, Boolean(waiting)])

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
      route_id: pickup.route_id,
      stop_id: pickup.stop_id,
      ...(origin ? { lat: origin.lat, lng: origin.lng } : {}),
      ...(destination ? { destination_stop_id: destination.stopId } : {}),
    },
  }), 'Control centre sees you waiting')
  const cancelSignal = () => run(() => api(`${base}/wait`, { method: 'DELETE' }), 'Waiting signal cancelled')

  const bestRouteNames = new Set(options.flatMap((option) => (option.legs ?? []).filter((leg) => leg.type === 'ride').map((leg) => placeKey(leg.route?.name))))
  const isBestRoute = (r) => [...bestRouteNames].some((name) => name && placeKey(r.name).includes(name))
  const routeNeedle = routeSearch.trim().toLowerCase()
  const timetableRoutes = routes
    .filter((r) => !routeNeedle || r.name.toLowerCase().includes(routeNeedle) || (r.stops ?? []).some((stop) => String(stop.name).toLowerCase().includes(routeNeedle)))
    .sort((a, b) => Number(isBestRoute(b)) - Number(isBestRoute(a)))

  return (
    <>
      <ScreenHeader kicker="Transport" title="Shuttles and rides" />
      <Body>
        <LoadState loading={loading && !data} error={error} onRetry={reload}>
          <RouteMap route={mapRoute} stop={mapStop} tag={tag} here={here} />

          <Card data-tour="waiting">
            <span className="t">I am waiting</span>
            <span className="s">Tell us where you are and where you want to go. We show the best shuttles, then you signal from the pickup stop. The signal expires after 20 minutes.</span>
            {places.length === 0 ? (
              <span className="s">Shuttle stops are published closer to the conference.</span>
            ) : waiting ? (
              <>
                <span className="s" role="status">
                  Waiting at <b className="text-ink">{waiting.stop}</b>
                  {waiting.journey?.to ? <> · going to <b className="text-ink">{waiting.journey.to}</b></> : null}
                </span>
                <div className="btn justify-between text-sun" role="status">
                  <span>Signal sent · expires in {countdown ?? '20:00'}</span>
                  <button type="button" disabled={busy} onClick={cancelSignal} className="font-bold text-cream">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <span className="lab">I am at</span>
                {here ? (
                  <span className="s" role="status">
                    {nearest
                      ? <>Near <b className="text-ink">{nearest.stop.name}</b>, {distanceLabel(nearest.distance)} away.</>
                      : 'Your location is on the map.'}
                  </span>
                ) : originPlace ? (
                  <span className="s" role="status">At <b className="text-ink">{originPlace.name}</b> (chosen by you).</span>
                ) : (
                  <span className="s">We use your phone’s location to find the stop nearest to you.</span>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn o sm" disabled={locating} onClick={() => locate()}>
                    <LocateFixed size={16} aria-hidden="true" />{locating ? 'Finding you…' : here ? 'Update location' : 'Use my location'}
                  </button>
                  <button type="button" className="btn o sm" aria-expanded={pickOrigin} onClick={() => setPickOrigin(!pickOrigin)}>
                    {pickOrigin ? 'Close list' : 'Choose a place'}
                  </button>
                </div>
                {pickOrigin && (
                  <PlacePicker
                    id="origin-place"
                    label="Where are you?"
                    places={waitPlaces}
                    value={originPlace}
                    placeholder="Search hotels, airport, venue"
                    onChange={(place) => { setOriginPlace(place); setHere(null); setPickOrigin(false) }}
                  />
                )}

                <PlacePicker
                  id="destination-place"
                  label="I want to go to"
                  places={places}
                  value={destination}
                  placeholder="Search a hotel, the venue or the airport"
                  onChange={setDestination}
                />
                {destination && !destination.hasPosition && <span className="s">This place has no map position yet, so routes to it cannot be proposed.</span>}

                {pickup && (
                  <span className="s" role="status">
                    Pickup stop: <b className="text-ink">{pickup.name}</b>
                    {chosen ? ` · ${chosen.summary}` : ''}
                  </span>
                )}
                <button type="button" className="btn y" disabled={busy || !pickup} onClick={sendSignal}>
                  {pickup ? 'Send my waiting signal' : 'Share where you are to continue'}
                </button>
              </>
            )}
          </Card>

          {!waiting && origin && (
            <BestRoutes
              plan={journeysPath ? journeys.data : null}
              loading={Boolean(journeysPath) && journeys.loading}
              error={journeysPath ? journeys.error : null}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onRetry={journeys.reload}
              destination={destination}
            />
          )}

          {waiting && <ComingShuttles waiting={waiting} shuttles={data?.shuttles} />}
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
              <span className="s">
                {bestRouteNames.size > 0 ? 'The best routes from where you are come first.' : 'Share your location above to see the best routes from where you are first.'}
              </span>
              <input type="search" aria-label="Search routes and stops" placeholder="Search a route or a stop" value={routeSearch} onChange={(e) => setRouteSearch(e.target.value)} />
              <div>
                {timetableRoutes.length === 0 && <span className="s">No route matches “{routeSearch}”.</span>}
                {timetableRoutes.map((r) => {
                  const times = (r.timetable ?? []).map((t) => (typeof t === 'string' ? t : t.time ?? t.departure ?? t.departs_at ?? '')).filter(Boolean)
                  const hours = [r.service_hours?.first_departure, r.service_hours?.last_departure].filter(Boolean).join(' to ')
                  const best = isBestRoute(r)
                  const proposal = best ? options.find((option) => (option.legs ?? []).some((leg) => leg.type === 'ride' && placeKey(r.name).includes(placeKey(leg.route?.name)))) : null
                  const stopsLine = (r.stops ?? []).map((stop) => stop.name).join(' → ')
                  return (
                    <ListRow key={r.id}>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="t">{r.name}</span>
                        {proposal && <span className="s">Next shuttle: {shuttleLabel(rideLeg(proposal)?.nextShuttle)}</span>}
                        <span className="s">{[r.frequency_minutes && `every ${r.frequency_minutes} min`, hours, times.slice(0, 6).join(' · ')].filter(Boolean).join(' · ') || stopsLine || r.description || 'Times to be published'}</span>
                      </span>
                      {best && <span className="pill t shrink-0">Best for you</span>}
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
