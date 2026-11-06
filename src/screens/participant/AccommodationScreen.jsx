import { useEffect, useState } from 'react'
import { ExternalLink, Mail, Phone } from 'lucide-react'
import Card, { StepRow } from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { api, listOf } from '../../lib/api'
import { useEventSlug, useRegistration } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

const day = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '–')

function choiceFromRegistration(registration, hotelsList) {
  if (!registration) return { choice: '', otherName: '' }
  if (registration.hotel_preference_id) {
    return { choice: String(registration.hotel_preference_id), otherName: '' }
  }
  const name = String(registration.staying_hotel_name ?? '').trim()
  if (!name) return { choice: '', otherName: '' }
  const match = hotelsList.find((hotel) => String(hotel.name ?? '').trim().toLowerCase() === name.toLowerCase())
  if (match) return { choice: String(match.id), otherName: '' }
  return { choice: 'other', otherName: name }
}

/** The delegate's hotel booking with its status steps, and the prequalified hotels. */
export default function AccommodationScreen() {
  const slug = useEventSlug()
  const navigateTo = useAppStore((state) => state.navigateTo)
  const showToast = useAppStore((state) => state.showToast)
  const { registration, loading, error, reload } = useRegistration()
  const hotels = useRemote(`/events/${encodeURIComponent(slug)}/hotels`)
  const [showPool, setShowPool] = useState(false)
  const [busy, setBusy] = useState(false)
  const [choice, setChoice] = useState('')
  const [otherName, setOtherName] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const stay = registration?.hotel_assignment
  // Self-sponsored (and any stay the sponsorship does not cover) picks the hotel here so transport can plan the pickup.
  const choosesHotel = registration && registration.hotel_covered === false
  const canSave = choice !== '' && (choice !== 'other' || otherName.trim() !== '')
  const hotelsList = listOf(hotels.data)

  useEffect(() => {
    if (!choosesHotel || hotels.loading) return
    const next = choiceFromRegistration(registration, hotelsList)
    setChoice(next.choice)
    setOtherName(next.otherName)
    setHydrated(true)
  }, [
    choosesHotel,
    hotels.loading,
    registration?.id,
    registration?.hotel_preference_id,
    registration?.staying_hotel_name,
    hotels.data,
  ])

  async function saveStay() {
    setBusy(true)
    try {
      const body = choice === 'other' ? { staying_hotel_name: otherName.trim() } : { event_hotel_id: Number(choice) }
      await api(`/participant/registrations/${registration.id}/staying-hotel`, { method: 'POST', body })
      showToast('Hotel saved. Transport will plan your pickup.')
      reload()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(false)
    }
  }

  async function confirmBooking() {
    setBusy(true)
    try {
      await api(`/participant/registrations/${registration.id}/hotel-assignment/acknowledge`, { method: 'POST', body: {} })
      showToast('Booking confirmed. Have a good stay.')
      reload()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(false)
    }
  }

  const savedLabel = registration?.staying_hotel_name
    || hotelsList.find((hotel) => String(hotel.id) === choice)?.name
    || (choice === 'other' ? otherName.trim() : '')

  return (
    <>
      <ScreenHeader kicker="Accommodation" title="Your hotel" back />
      <Body>
        <LoadState loading={loading} error={error} onRetry={reload}>
          {stay ? (
            <>
              <Card>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-[3px]">
                    <span className="t text-[17px]">{stay.hotel_name}</span>
                    <span className="s">{[stay.room_type, stay.room_number && `Room ${stay.room_number}`].filter(Boolean).join(' · ') || 'Room to be assigned'}</span>
                  </div>
                  <span className={`pill ${stay.pending_confirmation ? 'y' : 't'}`}>{stay.pending_confirmation ? 'Pending' : 'Confirmed'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Card className="card mint p-2.5"><span className="lab">Check-in</span><b>{day(stay.check_in_date)}</b></Card>
                <Card className="card mint p-2.5"><span className="lab">Check-out</span><b>{day(stay.check_out_date)}</b></Card>
                </div>
                <span className="s">{[stay.hotel_address, stay.reservation_reference && `Ref ${stay.reservation_reference}`].filter(Boolean).join(' · ')}</span>
                {(stay.hotel_email || stay.hotel_phone) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-maroon">
                    {stay.hotel_email && <a href={`mailto:${stay.hotel_email}`} className="inline-flex items-center gap-1"><Mail size={13} aria-hidden="true" />{stay.hotel_email}</a>}
                    {stay.hotel_phone && <a href={`tel:${stay.hotel_phone}`} className="inline-flex items-center gap-1"><Phone size={13} aria-hidden="true" />{stay.hotel_phone}</a>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn sm" onClick={() => navigateTo('transport')}>Shuttle to venue</button>
                  {stay.hotel_phone ? <a className="btn o sm" href={`tel:${stay.hotel_phone}`}>Call the hotel</a> : <button type="button" className="btn o sm" onClick={() => navigateTo('messages', { tab: 'desks' })}>Ask the desk</button>}
                </div>
              </Card>
              <Card>
                <span className="t">Booking status</span>
                <StepRow state="ok" title="Placed by the accommodation team" />
                <StepRow state={stay.pending_confirmation ? 'warn' : 'ok'} title={stay.pending_confirmation ? 'Waiting for the hotel to confirm' : 'Hotel confirmed'} />
                <StepRow state={stay.assignment_confirmed ? 'ok' : 'warn'} title={stay.assignment_confirmed ? 'You confirmed this booking' : 'Please confirm you received this booking'} />
                {!stay.assignment_confirmed && <button type="button" className="btn y sm" disabled={busy} onClick={confirmBooking}>I received my booking</button>}
              </Card>
            </>
          ) : (
            <Card>
              <span className="t">No hotel booked for you yet</span>
              <span className="s">If your registration includes accommodation, your hotel appears here once it is reserved.</span>
            </Card>
          )}

          {choosesHotel && (
            <Card>
              <span className="t">Where are you staying?</span>
              <span className="s">
                {savedLabel
                  ? `Saved hotel: ${savedLabel}. Change it below if your plans have changed.`
                  : 'Tell us your hotel so the shuttle team can plan your pickup.'}
              </span>
              <select
                value={hydrated ? choice : ''}
                onChange={(event) => setChoice(event.target.value)}
                aria-label="Hotel"
                className="w-full rounded-xl border border-mint-soft bg-white px-3 py-2.5 text-[15px]"
              >
                <option value="">Choose a hotel</option>
                {hotelsList.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
                ))}
                <option value="other">Another hotel</option>
              </select>
              {choice === 'other' && (
                <input value={otherName} onChange={(event) => setOtherName(event.target.value)} placeholder="Hotel name" aria-label="Hotel name" className="w-full rounded-xl border border-mint-soft bg-white px-3 py-2.5 text-[15px]" />
              )}
              <button type="button" className="btn sm" disabled={!canSave || busy} onClick={saveStay}>
                {savedLabel ? 'Update my hotel' : 'Save my hotel'}
              </button>
            </Card>
          )}

          <Card>
            <span className="t">Prequalified hotels</span>
            <span className="s">Hotels checked and approved for CPHIA 2026. Self-sponsored participants can contact them directly at the conference rate.</span>
            <button type="button" className="btn o sm" aria-expanded={showPool} onClick={() => setShowPool(!showPool)}>{showPool ? 'Hide prequalified hotels' : `See prequalified hotels (${hotelsList.length})`}</button>
            {showPool && hotelsList.map((hotel) => (
              <div key={hotel.id} className="flex flex-col gap-1.5 border-b border-mint-soft py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="t">{hotel.name}</span>
                  {hotel.star_label && <span className="pill y">{hotel.star_label}</span>}
                </div>
                <span className="s">{[hotel.address, hotel.distance_from_venue && `${hotel.distance_from_venue} from the venue`, hotel.rate_per_night && `from ${hotel.rate_per_night} a night`, hotel.breakfast_label].filter(Boolean).join(' · ')}</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-maroon">
                  {hotel.email && <a href={`mailto:${hotel.email}`} className="inline-flex items-center gap-1"><Mail size={13} aria-hidden="true" />{hotel.email}</a>}
                  {hotel.phone && <a href={`tel:${hotel.phone}`} className="inline-flex items-center gap-1"><Phone size={13} aria-hidden="true" />{hotel.phone}</a>}
                  {hotel.website && <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">Website <ExternalLink size={12} aria-hidden="true" /></a>}
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => navigateTo('directions', { kicker: 'Hotel', title: hotel.name, latitude: hotel.latitude ?? null, longitude: hotel.longitude ?? null, notes: hotel.address })}>Directions</button>
                </div>
              </div>
            ))}
          </Card>
        </LoadState>
      </Body>
    </>
  )
}
