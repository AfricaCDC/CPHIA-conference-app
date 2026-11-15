import Card from '../components/ui/Card'
import { MapPin } from 'lucide-react'
import ScreenHeader, { Body } from '../components/ui/ScreenHeader'
import { useBrandStore } from '../store/brandStore'

const HALF_SPAN_DEG = 0.003

/** OpenStreetMap embed (fallback when Platform Settings is set to OSM). */
export function osmEmbedUrl(latitude, longitude) {
  const bbox = [longitude - HALF_SPAN_DEG, latitude - HALF_SPAN_DEG, longitude + HALF_SPAN_DEG, latitude + HALF_SPAN_DEG].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`
}

/**
 * In-app map embed. Defaults to Google Maps (Platform Settings); OSM / Bing when configured.
 * @param {number} latitude
 * @param {number} longitude
 * @param {{ provider?: string, googleKey?: string|null }} [options]
 */
export function mapEmbedUrl(latitude, longitude, { provider = 'google', googleKey = null } = {}) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return osmEmbedUrl(0, 0)

  if (provider === 'osm') return osmEmbedUrl(lat, lng)

  if (provider === 'bing') {
    return `https://www.bing.com/maps/embed?h=320&w=600&cp=${lat}~${lng}&lvl=16`
  }

  // Google (default): Embed API when a key is present, otherwise the classic embed.
  if (googleKey) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleKey)}&q=${lat}%2C${lng}&zoom=16`
  }
  return `https://www.google.com/maps?q=${lat}%2C${lng}&z=16&output=embed`
}

/**
 * Where a room, hall or hotel is, shown in the app: a map, the directions notes and the floor plan.
 * params: { title, kicker, latitude, longitude, notes, floorPlanUrl }
 */
export default function DirectionsScreen({ params }) {
  const maps = useBrandStore((state) => state.maps)
  const hasPoint = params.latitude != null && params.longitude != null
  const embedSrc = hasPoint
    ? mapEmbedUrl(params.latitude, params.longitude, {
        provider: maps?.provider || 'google',
        googleKey: maps?.googleKey || null,
      })
    : null

  return (
    <>
      <ScreenHeader kicker={params.kicker ?? 'Directions'} title={params.title ?? 'Location'} back />
      <Body>
        {hasPoint ? (
          <div className="overflow-hidden rounded-[14px] border border-line bg-white">
            <iframe
              title={`Map of ${params.title ?? 'location'}`}
              src={embedSrc}
              className="h-[320px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allow="geolocation; fullscreen"
            />
          </div>
        ) : (
          <Card className="card mint">
            <span className="t">No map point yet</span>
            <span className="s">The organisers have not placed this on the map. Follow the notes below or ask at the information desk.</span>
          </Card>
        )}

        {params.notes && (
          <Card className="card">
            <span className="t inline-flex items-center gap-2"><MapPin size={16} aria-hidden="true" />How to get there</span>
            <span className="s whitespace-pre-line">{params.notes}</span>
          </Card>
        )}

        {params.floorPlanUrl && (
          <Card className="card">
            <span className="t">Floor plan</span>
            <img src={params.floorPlanUrl} alt={`Floor plan for ${params.title ?? 'this venue'}`} className="w-full rounded-xl border border-line bg-white" loading="lazy" />
          </Card>
        )}
      </Body>
    </>
  )
}
