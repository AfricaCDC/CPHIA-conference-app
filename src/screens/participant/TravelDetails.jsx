import { useEffect, useState } from 'react'
import Card, { InfoRow } from '../../components/ui/Card'
import { api } from '../../lib/api'
import { openProtectedFile } from '../../lib/files'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

const EMPTY = { departure_country: '', departure_city: '', departure_date: '', departure_airport: '', arrival_country: '', arrival_city: '', arrival_date: '' }

/** Same wording as the registration website, so the delegate reads one message in both places. */
function copyFor(forTicket, sponsored) {
  if (forTicket) {
    return {
      title: 'Travel details',
      body: 'Add the city you will travel from and your travel dates so your ticket can be planned. Tickets cannot be issued until this is complete.',
      saved: 'Travel details complete. The travel team can now book your ticket.',
    }
  }
  return {
    title: 'Your travel plan',
    body: sponsored
      ? 'Your sponsorship does not include a ticket. Tell us where you travel from and your travel dates so the transport team can arrange your airport transport.'
      : 'Tell us where you travel from and your travel dates so the transport team can arrange your airport transport.',
    saved: 'Travel plan received. The transport team can use it to arrange your airport transport.',
  }
}

const place = (city, country, date) => [[city, country].filter(Boolean).join(', '), date].filter(Boolean).join(' · ') || '—'

function ItinerarySummary({ itinerary }) {
  return (
    <dl>
      <InfoRow label="Departure" value={place(itinerary?.departure_city, itinerary?.departure_country, itinerary?.departure_date)} />
      {itinerary?.departure_airport && <InfoRow label="Airport of origin" value={itinerary.departure_airport} />}
      <InfoRow label="Return" value={place(itinerary?.arrival_city, itinerary?.arrival_country, itinerary?.arrival_date)} />
    </dl>
  )
}

/** Departure and return details for a delegate whose ticket CPHIA books. */
function ItineraryForm({ base, itinerary, onSaved, saveLabel = 'Save travel details' }) {
  const showToast = useAppStore((state) => state.showToast)
  const [form, setForm] = useState(() => ({ ...EMPTY, ...Object.fromEntries(Object.entries(itinerary ?? {}).filter(([key, value]) => key in EMPTY && value)) }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const countries = useRemote('/travel-catalog/countries')
  const cities = useRemote(form.departure_country ? `/travel-catalog/cities?country_name=${encodeURIComponent(form.departure_country)}` : null)
  const countryNames = (countries.data?.data ?? []).map((country) => country.name)
  const cityNames = (cities.data?.data ?? []).map((city) => city.name)

  // The return ticket takes the delegate back to where they started.
  function setDeparture(patch) {
    setForm((current) => {
      const next = { ...current, ...patch }
      return { ...next, arrival_country: next.departure_country, arrival_city: next.departure_city }
    })
  }

  async function save(event) {
    event.preventDefault()
    setError(null)
    if (!form.departure_country || !form.departure_city.trim() || !form.departure_date || !form.arrival_date) {
      setError('Choose your country, city and both travel dates.')
      return
    }
    if (form.arrival_date < form.departure_date) {
      setError('Your return date cannot be before your departure date.')
      return
    }
    setBusy(true)
    try {
      const saved = await api(`${base}/travel-profile`, {
        method: 'PUT',
        body: { ...form, departure_city: form.departure_city.trim(), arrival_city: form.departure_city.trim(), departure_airport: form.departure_airport.trim() },
      })
      showToast('Travel details saved')
      onSaved(saved?.travel)
    } catch (err) {
      const fieldError = Object.values(err.body?.errors ?? {})[0]?.[0]
      setError(fieldError ?? err.body?.error ?? err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label className="lab" htmlFor="travel-country">Country you travel from</label>
      <select id="travel-country" required value={form.departure_country} onChange={(e) => setDeparture({ departure_country: e.target.value, departure_city: '' })}>
        <option value="">{countries.loading ? 'Loading countries…' : 'Select country'}</option>
        {form.departure_country && !countryNames.includes(form.departure_country) && <option value={form.departure_country}>{form.departure_country}</option>}
        {countryNames.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      {countries.error && <button type="button" className="btn o sm" onClick={countries.reload}>Could not load countries. Try again</button>}

      <label className="lab" htmlFor="travel-city">City you travel from</label>
      <input
        id="travel-city"
        list="travel-city-options"
        required
        maxLength={120}
        autoComplete="off"
        disabled={!form.departure_country}
        placeholder={!form.departure_country ? 'Select country first' : cities.loading ? 'Loading cities…' : 'Choose or type your city'}
        value={form.departure_city}
        onChange={(e) => setDeparture({ departure_city: e.target.value })}
      />
      <datalist id="travel-city-options">
        {cityNames.map((name) => <option key={name} value={name} />)}
      </datalist>

      <label className="lab" htmlFor="travel-airport">Airport of origin (optional)</label>
      <input id="travel-airport" maxLength={160} placeholder="e.g. Jomo Kenyatta International Airport (NBO)" value={form.departure_airport} onChange={(e) => setForm({ ...form, departure_airport: e.target.value })} />

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="lab" htmlFor="travel-departure-date">Departure date</label>
          <input id="travel-departure-date" type="date" required value={form.departure_date} onChange={(e) => setForm({ ...form, departure_date: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="lab" htmlFor="travel-return-date">Return date</label>
          <input id="travel-return-date" type="date" required min={form.departure_date || undefined} value={form.arrival_date} onChange={(e) => setForm({ ...form, arrival_date: e.target.value })} />
        </div>
      </div>
      <span className="s">Your return ticket takes you back to the city you travel from.</span>
      {error && <span className="s text-maroon" role="alert">{error}</span>}
      <button type="submit" className="btn sm" disabled={busy}>{busy ? 'Saving…' : saveLabel}</button>
    </form>
  )
}

/**
 * Itinerary only when CPHIA books a ticket (or early Youth / government planning).
 * No form when the registration has no ticket benefit — including self-sponsored.
 */
export default function TravelDetails({ registration, onChanged }) {
  const base = `/participant/registrations/${registration.id}`
  const detail = useRemote(base)
  const showToast = useAppStore((state) => state.showToast)
  const [travel, setTravel] = useState(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (detail.data?.travel) setTravel(detail.data.travel)
  }, [detail.data])

  // Ticket-benefit itinerary, or early Youth / government itinerary — never the old
  // "planning" own-ticket form for people without a ticket benefit.
  const needsItinerary = Boolean(
    travel
    && (travel.required || travel.pending_youth_decision || travel.government_delegate),
  )
  if (!needsItinerary) return null

  const forTicket = Boolean(travel.required)
  const copy = copyFor(forTicket, Boolean(detail.data?.is_sponsored))

  function saved(next) {
    if (next) setTravel(next)
    else detail.reload()
    setEditing(false)
    onChanged?.()
  }

  const ownTicket = Boolean(travel.planning) && !forTicket
  // Someone who books their own flight types their plan here; nothing is uploaded in the app.
  // A file they already sent from the website stays viewable.
  const planFile = ownTicket && travel.travel_plan?.uploaded ? (
    <button type="button" className="btn o sm" onClick={() => openProtectedFile(`${base}/travel-plan`, { title: travel.travel_plan?.name ?? 'Travel plan' }).catch((e) => showToast(e.message, 'info'))}>
      View the plan you uploaded{travel.travel_plan?.name ? ` (${travel.travel_plan.name})` : ''}
    </button>
  ) : null

  let content
  if (ownTicket) {
    content = travel.itinerary_filled && !editing ? (
      <>
        <span className="s">{copy.saved}</span>
        <ItinerarySummary itinerary={travel.itinerary} />
        {planFile}
        <button type="button" className="btn o sm" onClick={() => setEditing(true)}>Change my travel plan</button>
      </>
    ) : (
      <>
        {planFile}
        <ItineraryForm base={base} itinerary={travel.itinerary} onSaved={saved} saveLabel="Save my travel plan" />
      </>
    )
  } else if (travel.itinerary_locked) {
    content = (
      <>
        <span className="s">{travel.itinerary_lock_reason ?? 'A ticket has been uploaded. Your flight itinerary can no longer be changed. Contact the organisers if a correction is required.'}</span>
        <ItinerarySummary itinerary={travel.itinerary} />
      </>
    )
  } else if (travel.complete) {
    content = (
      <>
        <span className="s">{copy.saved}</span>
        <ItinerarySummary itinerary={travel.itinerary} />
        <span className="s">Need to change something? Message the travel desk below.</span>
      </>
    )
  } else {
    content = <ItineraryForm base={base} itinerary={travel.itinerary} onSaved={saved} />
  }

  const done = ownTicket ? Boolean(travel.travel_plan?.uploaded || travel.itinerary_filled) : Boolean(travel.complete)

  return (
    <Card tone={done ? '' : 'mint'}>
      <div className="flex items-center justify-between gap-2">
        <span className="t">{copy.title}</span>
        <span className={`pill ${done ? 't' : ''}`}>{done ? 'Received' : 'Needed'}</span>
      </div>
      {!(forTicket ? travel.complete : travel.itinerary_filled && !editing) && <span className="s">{copy.body}</span>}
      {travel.pending_youth_decision && <span className="s">Your sponsorship decision is still pending. You can submit your itinerary now; no ticket is booked until your sponsorship is confirmed.</span>}
      {travel.government_delegate && <span className="s">As part of your government delegation, please share your itinerary so the organisers can plan arrivals. Sharing it does not by itself mean a ticket will be booked for you.</span>}
      {content}
    </Card>
  )
}
