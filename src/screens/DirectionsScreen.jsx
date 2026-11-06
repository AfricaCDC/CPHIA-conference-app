import Card from '../components/ui/Card'
import { MapPin } from 'lucide-react'
import ScreenHeader, { Body } from '../components/ui/ScreenHeader'

const HALF_SPAN_DEG = 0.003

/** OpenStreetMap embed centred on the point, with a marker. Shown inside the app, no new tab. */
export function mapEmbedUrl(latitude, longitude) {
  const bbox = [longitude - HALF_SPAN_DEG, latitude - HALF_SPAN_DEG, longitude + HALF_SPAN_DEG, latitude + HALF_SPAN_DEG].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`
}

/**
 * Where a room, hall or hotel is, shown in the app: a map, the directions notes and the floor plan.
 * params: { title, kicker, latitude, longitude, notes, floorPlanUrl }
 */
export default function DirectionsScreen({ params }) {
  const hasPoint = params.latitude != null && params.longitude != null

  return (
    <>
      <ScreenHeader kicker={params.kicker ?? 'Directions'} title={params.title ?? 'Location'} back />
      <Body>
        {hasPoint ? (
          <div className="overflow-hidden rounded-[14px] border border-line bg-white">
            <iframe
              title={`Map of ${params.title ?? 'location'}`}
              src={mapEmbedUrl(params.latitude, params.longitude)}
              className="h-[320px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer"
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
