import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import Card, { InfoRow } from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { api } from '../../lib/api'
import { openProtectedFile } from '../../lib/files'
import { formatDateTime } from '../../lib/format'
import { money, useLogistics, useRegistration } from '../../lib/useParticipant'
import LogisticsThread from './LogisticsThread'
import TravelDetails from './TravelDetails'
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

/** Issued e-ticket preview for registrations that include a ticket benefit. */
function IssuedTicket({ base, ticket, logisticsTicket, busy, onConfirm, onFeedback, problem, setProblem }) {
  const showToast = useAppStore((state) => state.showToast)
  const flight = logisticsTicket ?? ticket
  const route = [flight?.departure_city, flight?.arrival_city].filter(Boolean).join(' → ')
  const dates = [flight?.departure_date, flight?.arrival_date].filter(Boolean).join(' · ')

  return (
    <>
      <Card tone="mint">
        <div className="flex items-center justify-between gap-2">
          <span className="s">{[ticket.airline_name || flight?.airline_name, ticket.flight_number || flight?.flight_number].filter(Boolean).join(' · ') || 'E-ticket'}</span>
          <span className="pill t">Issued</span>
        </div>
        <span className="t">{ticket.document_name ?? flight?.document_name ?? 'E-ticket'}</span>
        {route && <span className="s">{route}{dates ? ` · ${dates}` : ''}</span>}
        {flight?.pnr_reference && <InfoRow label="PNR" value={flight.pnr_reference} />}
        <button type="button" className="btn o sm" onClick={() => openProtectedFile(`${base}/ticket-document`, { title: ticket.document_name ?? 'E-ticket' }).catch((e) => showToast(e.message, 'info'))}>View e-ticket</button>
      </Card>
      <Card>
        <span className="t">Did you receive this ticket?</span>
        <span className="s">Confirming tells the travel team your ticket is complete. If something is wrong, send a message instead.</span>
        {ticket.receipt_confirmed_at ? (
          <div className="btn text-teal">✓ Confirmed on {formatDateTime(ticket.receipt_confirmed_at)}</div>
        ) : (
          <button type="button" className="btn" disabled={busy} onClick={onConfirm}>
            Yes, I received my ticket
          </button>
        )}
      </Card>
      <Card>
        <label className="lab" htmlFor="ticket-problem">Something wrong with the ticket?</label>
        <textarea id="ticket-problem" rows="2" maxLength={4000} placeholder="Wrong name, date or route" value={problem} onChange={(e) => setProblem(e.target.value)} />
        <button type="button" className="btn o sm" disabled={busy || !problem.trim()} onClick={onFeedback}>
          Send to travel team
        </button>
      </Card>
    </>
  )
}

/** Own ticket + travel claim uploads for DSA-covered delegates (ticket ≠ boarding pass). */
function OwnTicketAndClaimUploads({ base, docs, busy, onUpload }) {
  const showToast = useAppStore((state) => state.showToast)
  const ticketInput = useRef(null)
  const claimInput = useRef(null)
  const canUploadTicket = Boolean(docs?.can_upload_ticket || docs?.requires_ticket)
  if (!docs) return null

  return (
    <>
      <h2 className="h3">Your flight documents</h2>
      <p className="s">
        If CPHIA has not issued your e-ticket yet, upload your air ticket here (this is not your boarding pass). Also upload your completed travel claim for DSA.
      </p>
      {canUploadTicket && (
        <Card>
          <span className="t">{docs.has_ticket ? 'Ticket on file' : 'Upload your ticket'}</span>
          <span className="s">
            {docs.has_ticket
              ? `On file: ${docs.ticket_name || 'Ticket'}. You can replace it until Travel issues one.`
              : 'PDF or a clear photo of your air ticket / e-ticket receipt.'}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {docs.has_ticket && docs.ticket_source === 'dsa' ? (
              <button
                type="button"
                className="btn o sm"
                onClick={() => openProtectedFile(`${base}/dsa/ticket`, { title: docs.ticket_name || 'Ticket' }).catch((e) => showToast(e.message, 'info'))}
              >
                <Download size={16} aria-hidden="true" />View
              </button>
            ) : <span />}
            <button type="button" className="btn sm" disabled={busy === 'ticket'} onClick={() => ticketInput.current?.click()}>
              <Upload size={16} aria-hidden="true" />{busy === 'ticket' ? 'Uploading…' : docs.has_ticket ? 'Replace' : 'Upload ticket'}
            </button>
          </div>
          <input ref={ticketInput} type="file" accept="image/*,application/pdf" className="hidden" aria-hidden="true" tabIndex={-1} onChange={(e) => onUpload('ticket', e)} />
        </Card>
      )}
      <Card>
        <span className="t">{docs.has_claim ? 'Travel claim on file' : 'Upload travel claim'}</span>
        <span className="s">
          {docs.has_claim
            ? `On file: ${docs.claim_name || 'Travel claim'}`
            : 'Download the blank form from Finance, fill it in, then upload the completed claim here.'}
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn o sm"
            onClick={() => openProtectedFile(`${base}/dsa/travel-claim-form`, { title: 'Travel claim form' }).catch((e) => showToast(e.message, 'info'))}
          >
            <Download size={16} aria-hidden="true" />Blank form
          </button>
          <button type="button" className="btn sm" disabled={busy === 'travel-claim'} onClick={() => claimInput.current?.click()}>
            <Upload size={16} aria-hidden="true" />{busy === 'travel-claim' ? 'Uploading…' : docs.has_claim ? 'Replace' : 'Upload claim'}
          </button>
        </div>
        {docs.has_claim ? (
          <button
            type="button"
            className="btn o sm"
            onClick={() => openProtectedFile(`${base}/dsa/travel-claim`, { title: docs.claim_name || 'Travel claim' }).catch((e) => showToast(e.message, 'info'))}
          >
            View uploaded claim
          </button>
        ) : null}
        <input ref={claimInput} type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden" aria-hidden="true" tabIndex={-1} onChange={(e) => onUpload('travel-claim', e)} />
      </Card>
    </>
  )
}

/** The delegate's e-ticket: confirm receipt, or tell the travel team something is wrong. */
export default function TravelScreen() {
  const showToast = useAppStore((state) => state.showToast)
  const { registration, loading, error, reload } = useRegistration()
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const planInput = useRef(null)
  const ticket = registration?.ticket_document
  const travel = registration?.travel ?? {}
  const ticketBenefit = Boolean(travel.required || ticket)
  const base = registration ? `/participant/registrations/${registration.id}` : ''
  const logistics = useLogistics(registration)
  const logisticsTicket = logistics.data?.ticket
  const dsaDocs = logistics.data?.dsa_documents
  const dsaCovered = Boolean(logistics.data?.dsa_covered)
  const showOwnUploads = dsaCovered
  const canUploadTravelPlan = Boolean(travel.planning) && !travel.required

  async function run(action, message) {
    setBusy(true)
    try {
      await action()
      showToast(message)
      reload()
      logistics.reload()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(false)
    }
  }

  async function uploadDoc(kind, event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    setBusy(kind)
    try {
      await api(kind === 'travel-plan' ? `${base}/travel-plan` : `${base}/dsa/${kind}`, { method: 'POST', body })
      showToast(kind === 'ticket' ? 'Ticket uploaded. Finance can see it.' : kind === 'travel-plan' ? 'Travel plan uploaded.' : 'Travel claim uploaded.')
      logistics.reload()
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
          {registration && ticketBenefit && <TravelDetails registration={registration} onChanged={() => { reload(); logistics.reload() }} />}
          {ticket ? (
            <IssuedTicket
              base={base}
              ticket={ticket}
              logisticsTicket={logisticsTicket}
              busy={busy}
              problem={problem}
              setProblem={setProblem}
              onConfirm={() => run(() => api(`${base}/ticket/acknowledge`, { method: 'POST', body: {} }), 'Thank you. The travel team has been told.')}
              onFeedback={() => run(() => api(`${base}/ticket/feedback`, { method: 'POST', body: { body: problem.trim() } }).then(() => setProblem('')), 'Sent to the travel team')}
            />
          ) : (
            <Card>
              <span className="t">{ticketBenefit ? 'No ticket yet' : 'No CPHIA-booked ticket'}</span>
              <span className="s">
                {travel.required
                  ? travel.filled
                    ? 'Your travel details are with the travel team. Your e-ticket appears here once it is booked — or upload your own ticket below if you already have one.'
                    : 'The travel team needs your departure and return details before booking. Add them above.'
                  : dsaCovered
                    ? 'CPHIA is not booking this flight. Upload your air ticket and travel claim below for DSA (boarding pass is uploaded separately under Finance).'
                    : 'Your registration does not include a flight booked by CPHIA. Airport pickup shows under Transport once it is assigned.'}
              </span>
            </Card>
          )}
          {canUploadTravelPlan && (
            <Card>
              <span className="t">{travel.travel_plan?.uploaded ? 'Travel plan on file' : 'Upload your flight itinerary or ticket'}</span>
              <span className="s">
                {travel.travel_plan?.uploaded
                  ? `On file: ${travel.travel_plan.name || 'Travel plan'}. You can replace it.`
                  : 'PDF or a clear photo. The transport team uses this file to arrange your airport transport.'}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {travel.travel_plan?.uploaded ? (
                  <button type="button" className="btn o sm" onClick={() => openProtectedFile(`${base}/travel-plan`, { title: travel.travel_plan?.name || 'Travel plan' }).catch((e) => showToast(e.message, 'info'))}>
                    <Download size={16} aria-hidden="true" />View
                  </button>
                ) : <span />}
                <button type="button" className="btn sm" disabled={busy === 'travel-plan'} onClick={() => planInput.current?.click()}>
                  <Upload size={16} aria-hidden="true" />{busy === 'travel-plan' ? 'Uploading…' : travel.travel_plan?.uploaded ? 'Replace' : 'Upload'}
                </button>
              </div>
              <input ref={planInput} type="file" accept="image/*,application/pdf" className="hidden" aria-hidden="true" tabIndex={-1} onChange={(e) => uploadDoc('travel-plan', e)} />
            </Card>
          )}
          {showOwnUploads && (
            <OwnTicketAndClaimUploads base={base} docs={dsaDocs} busy={busy} onUpload={uploadDoc} />
          )}
          <Card tone="mint">
            <span className="t">Airport pickup</span>
            <span className="s">Meet the CPHIA desk after immigration. Your transfer shows under Transport once it is assigned.</span>
          </Card>
          {ticketBenefit && (
            <>
              <h2 className="h3">Message the travel desk</h2>
              <LogisticsThread topic="[Ticket]" placeholder="Ask the travel team about your flight" />
            </>
          )}
        </LoadState>
      </Body>
    </>
  )
}
