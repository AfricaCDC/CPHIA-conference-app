import Card from '../../components/ui/Card'
import { MapPin, Navigation } from 'lucide-react'
import FloorPlan from '../../components/FloorPlan'
import SessionCard from '../../components/SessionCard'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { formatDayLong } from '../../lib/format'
import { useProgramme } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

/** One room: where it is, what is on in it, and how to get there in the app. */
export default function HallScreen({ params }) {
  const hall = params.hall ?? {}
  const navigateTo = useAppStore((state) => state.navigateTo)
  const { sessions } = useProgramme()
  const programme = sessions
    .filter((s) => s.hall?.id === hall.id)
    .sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`))
  const hasPoint = hall.latitude != null && hall.longitude != null
  const mapsUrl = hall.google_directions_url ?? hall.directions_url ?? null
  const showOnMap = () => navigateTo('directions', {
    kicker: hall.venue?.name ?? 'Venue',
    title: hall.name,
    latitude: hall.latitude,
    longitude: hall.longitude,
    notes: hall.directions_notes ?? hall.venue?.directions_notes ?? null,
    floorPlanUrl: hall.floor_plan_url ?? null,
  })
  const details = [
    ['Venue', hall.venue?.name],
    ['Building', hall.building],
    ['Floor', hall.floor_label],
    ['Room', hall.room_number],
    ['Type', hall.room_type_label],
    ['Seats (theatre)', hall.capacity_theatre ?? hall.capacity],
    ['Area', hall.area_sqm ? `${hall.area_sqm} m²` : null],
    ['Interpretation booths', hall.interpretation_booths || null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')

  return (
    <>
      <ScreenHeader kicker={hall.venue?.name ?? 'Venue'} title={hall.name ?? 'Room'} back />
      <Body>
        <FloorPlan url={hall.floor_plan_url} kind={hall.floor_plan_kind} title={hall.name} />

        <Card className="card flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/25 text-tertiary"><MapPin size={22} aria-hidden="true" /></span>
            <span className="text-[17px] font-extrabold">{hall.name}</span>
          </div>
          {details.length > 0 && (
            <dl className="flex flex-col">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-mint-soft py-2 last:border-0">
                  <dt className="text-[13px] text-muted">{label}</dt>
                  <dd className="text-right text-[14px] font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {hall.directions_notes && <p className="whitespace-pre-line text-[14px] leading-relaxed">{hall.directions_notes}</p>}
          {hasPoint ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={showOnMap} className="btn o sm"><MapPin size={16} aria-hidden="true" />On map</button>
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn sm"><Navigation size={16} aria-hidden="true" />Open in Maps</a>}
            </div>
          ) : (
            <span className="text-[12px] text-muted">This room is not on the map yet. Follow the notes above.</span>
          )}
        </Card>

        <h2 className="h3">Programme in this room</h2>
        {programme.length === 0 && <div className="empty">Nothing is scheduled in this room yet.</div>}
        <div className="flex flex-col gap-2">
          {programme.map((session) => (
            <div key={session.id}>
              <span className="mb-1 block text-[12px] font-bold text-muted">{formatDayLong(session.date)}</span>
              <SessionCard session={session} />
            </div>
          ))}
        </div>
      </Body>
    </>
  )
}
