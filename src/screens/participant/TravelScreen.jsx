import { useState } from 'react'
import Card, { InfoRow } from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { api } from '../../lib/api'
import { openProtectedFile } from '../../lib/files'
import { formatDateTime } from '../../lib/format'
import { money, useLogistics, useRegistration } from '../../lib/useParticipant'
import LogisticsThread from './LogisticsThread'
import { useAppStore } from '../../store/appStore'

const when = (iso) => (iso ? formatDateTime(iso) : null)

/** Flight options proposed by the travel team: accept one, or decline with a comment. */
function Itineraries({ base, options, responseHours, onDone }) {
  const showToast = useAppStore((state) => state.showToast)
  const [busy, setBusy] = useState(null)
  const [declining, setDeclining] = useState(null)
  const [comment, setComment] = useState('')
  if (!options.length) return null

  async function run(key, path, body, message) {
    setBusy(key)
    try {
      await api(path, { method: 'POST', body })
      showToast(message)
      setDeclining(null)
      setComment('')
      onDone()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <h2 className="h3">Flight options</h2>
      {options.some((o) => o.is_open) && <p className="s">Pick the option that works for you{responseHours ? ` within ${responseHours} hours` : ''}, or decline with a reason.</p>}
      {options.map((option) => (
        <Card key={option.id} tone={option.is_open ? '' : 'mint'}>
          <div className="flex items-center justify-between gap-2">
            <span className="t">{[option.airline_name, option.flight_numbers].filter(Boolean).join(' · ') || 'Flight option'}</span>
            <span className={`pill ${option.status === 'selected' || option.status === 'accepted' ? 't' : option.is_open ? 'y' : ''}`}>{option.status_label}</span>
          </div>
          {option.route && <span className="s">{option.route}</span>}
          <dl>
            {option.outbound_departure_at && <InfoRow label="Outbound" value={[when(option.outbound_departure_at), when(option.outbound_arrival_at)].filter(Boolean).join(' → ')} />}
            {option.return_departure_at && <InfoRow label="Return" value={[when(option.return_departure_at), when(option.return_arrival_at)].filter(Boolean).join(' → ')} />}
            {option.fare_amount != null && <InfoRow label="Fare" value={money(option.fare_amount, option.fare_currency)} />}
            {option.expires_at && option.is_open && <InfoRow label="Reply by" value={when(option.expires_at)} />}
          </dl>
          {option.details && <span className="s whitespace-pre-line">{option.details}</span>}
          {option.participant_comment && <span className="s">Your comment: {option.participant_comment}</span>}
          {declining === option.id ? (
            <>
              <textarea rows={2} maxLength={2000} aria-label="Why this option does not work" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Why this option does not work for you" />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn o sm" onClick={() => setDeclining(null)}>Back</button>
                <button type="button" className="btn m sm" disabled={!comment.trim() || busy === option.id} onClick={() => run(option.id, `${base}/logistics/itineraries/${option.id}/decline`, { comment }, 'The travel team has your comment')}>Decline</button>
              </div>
            </>
          ) : (
            (option.is_open || option.can_decline) && (
              <div className="grid grid-cols-2 gap-2">
                {option.is_open ? <button type="button" className="btn y sm" disabled={busy === option.id} onClick={() => run(option.id, `${base}/logistics/itineraries/${option.id}/accept`, {}, 'Option accepted. The travel team books it.')}>Accept</button> : <span />}
                {option.can_decline && <button type="button" className="btn o sm" onClick={() => setDeclining(option.id)}>Decline</button>}
              </div>
            )
          )}
        </Card>
      ))}
    </>
  )
}

/** The delegate's e-ticket: confirm receipt, or tell the travel team something is wrong. */
export default function TravelScreen() {
  const showToast = useAppStore((state) => state.showToast)
  const { registration, loading, error, reload } = useRegistration()
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const ticket = registration?.ticket_document
  const travel = registration?.travel ?? {}
  const base = registration ? `/participant/registrations/${registration.id}` : ''
  const logistics = useLogistics(registration)

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

  return (
    <>
      <ScreenHeader kicker="Travel" title="Your ticket" back />
      <Body>
        <LoadState loading={loading} error={error} onRetry={reload}>
          <Itineraries base={base} options={logistics.data?.itineraries ?? []} responseHours={logistics.data?.itinerary_response_hours} onDone={() => { logistics.reload(); reload() }} />
          {ticket ? (
            <>
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <span className="s">{[ticket.airline_name, ticket.flight_number].filter(Boolean).join(' · ') || 'E-ticket'}</span>
                  <span className="pill">Issued</span>
                </div>
                <span className="t">{ticket.document_name ?? 'E-ticket'}</span>
                <button type="button" className="btn o sm" onClick={() => openProtectedFile(`${base}/ticket-document`, { title: ticket.document_name ?? 'E-ticket' }).catch((e) => showToast(e.message, 'info'))}>View e-ticket</button>
              </Card>
              <Card tone="yellow">
                <span className="t">Did you receive this ticket?</span>
                <span className="s">Confirming tells the travel team your ticket is complete. If something is wrong, send a message instead.</span>
                {ticket.receipt_confirmed_at ? (
                  <div className="btn text-sun">✓ Confirmed on {formatDateTime(ticket.receipt_confirmed_at)}</div>
                ) : (
                  <button type="button" className="btn text-sun" disabled={busy} onClick={() => run(() => api(`${base}/ticket/acknowledge`, { method: 'POST', body: {} }), 'Thank you. The travel team has been told.')}>
                    Yes, I received my ticket
                  </button>
                )}
              </Card>
              <Card>
                <label className="lab" htmlFor="ticket-problem">Something wrong with the ticket?</label>
                <textarea id="ticket-problem" rows="2" maxLength={4000} placeholder="Wrong name, date or route" value={problem} onChange={(e) => setProblem(e.target.value)} />
                <button
                  type="button"
                  className="btn o sm"
                  disabled={busy || !problem.trim()}
                  onClick={() => run(() => api(`${base}/ticket/feedback`, { method: 'POST', body: { body: problem.trim() } }).then(() => setProblem('')), 'Sent to the travel team')}
                >
                  Send to travel team
                </button>
              </Card>
            </>
          ) : (
            <Card>
              <span className="t">No ticket yet</span>
              <span className="s">
                {travel.required || travel.planning
                  ? travel.filled
                    ? 'Your travel details are with the travel team. Your e-ticket appears here once it is booked.'
                    : 'The travel team needs your departure and return details before booking. Add them on the registration website or message the desk.'
                  : 'Your registration does not include a flight booked by CPHIA.'}
              </span>
            </Card>
          )}
          <Card tone="mint">
            <span className="t">Airport pickup</span>
            <span className="s">Meet the CPHIA desk after immigration. Your transfer shows under Transport once it is assigned.</span>
          </Card>
          <h2 className="h3">Message the travel desk</h2>
          <LogisticsThread topic="[Ticket]" placeholder="Ask the travel team about your flight" />
        </LoadState>
      </Body>
    </>
  )
}
