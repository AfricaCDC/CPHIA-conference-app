import ListRow from '../../components/ui/ListRow'
import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import Card, { InfoRow, StepRow } from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import LogisticsThread from './LogisticsThread'
import { api, firstFieldError } from '../../lib/api'
import { openProtectedFile } from '../../lib/files'
import { formatDateTime } from '../../lib/format'
import { money, useLogistics, useRegistration } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

const PAID = ['paid', 'confirmed', 'closed']
const EXTRA_CATEGORIES = [['visa', 'Visa fee'], ['transport', 'Local transport'], ['other', 'Other']]
const BANK_FIELDS = [
  ['account_holder_name', 'Account holder name', true],
  ['bank_name', 'Bank name', true],
  ['account_number', 'Account number or IBAN', true],
  ['routing_or_swift_code', 'SWIFT, ABA or routing code', true],
  ['bank_address', 'Bank address', false],
  ['bank_country', 'Bank country', false],
]

function useAction(onDone) {
  const showToast = useAppStore((state) => state.showToast)
  const [busy, setBusy] = useState(null)
  async function run(key, action, message) {
    setBusy(key)
    try {
      await action()
      if (message) showToast(message)
      onDone()
      return true
    } catch (err) {
      showToast(err.message, 'info')
      return false
    } finally {
      setBusy(null)
    }
  }
  return [busy, run]
}

/** Registration fee: status, amount, receipt or a link to pay. */
function RegistrationFee({ registration }) {
  const showToast = useAppStore((state) => state.showToast)
  const status = registration.payment_status
  const paid = ['paid', 'waived'].includes(status)
  const amount = money(registration.amount, registration.effective_currency)

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <span className="t">Registration fee</span>
        <span className={`pill ${paid ? 't' : 'y'}`}>{status === 'waived' ? 'Waived' : paid ? 'Paid' : 'To pay'}</span>
      </div>
      <span className="s">{status === 'waived' ? 'Your registration fee is covered.' : [amount, registration.payment_method_options?.current_label].filter(Boolean).join(' · ') || 'No fee recorded'}</span>
      {status === 'paid' && (
        <button type="button" className="btn o sm" onClick={() => openProtectedFile(`/api/participant/registrations/${registration.id}/receipt/pdf`, { title: 'Payment receipt' }).catch((e) => showToast(e.message, 'info'))}>
          <Download size={16} aria-hidden="true" />Payment receipt
        </button>
      )}
      {!paid && registration.pay_url && <a className="btn y sm" href={registration.pay_url} target="_blank" rel="noopener noreferrer">Pay the registration fee</a>}
      {!paid && registration.workflow?.payment_blocked_reason && <span className="s">{registration.workflow.payment_blocked_reason}</span>}
    </Card>
  )
}

/** What finance or travel asked for, with the reply. */
function InfoRequests({ base, requests, onDone }) {
  const [busy, run] = useAction(onDone)
  const [notes, setNotes] = useState({})
  if (!requests.length) return null

  return requests.map((request) => (
    <Card key={request.id} tone="yellow">
      <span className="t">{request.requested_by_partner ?? 'The desk'} needs more information</span>
      {request.message && <span className="s whitespace-pre-line">{request.message}</span>}
      <div className="flex flex-col">
        {request.fields.map((field) => <StepRow key={field.key} state={field.satisfied ? 'ok' : 'warn'} title={field.label} />)}
      </div>
      <label className="lab" htmlFor={`ir-${request.id}`}>Your reply</label>
      <textarea id={`ir-${request.id}`} rows={2} maxLength={4000} value={notes[request.id] ?? ''} onChange={(e) => setNotes({ ...notes, [request.id]: e.target.value })} placeholder="Optional note for the desk" />
      <button
        type="button"
        className="btn sm"
        disabled={busy === request.id}
        onClick={() => run(request.id, () => api(`${base}/logistics/info-requests/${request.id}/respond`, { method: 'POST', body: { note: notes[request.id] || null } }), 'Sent. The desk will check it.')}
      >
        I have provided this
      </button>
    </Card>
  ))
}

function DsaCard({ base, dsa, covered, onDone }) {
  const showToast = useAppStore((state) => state.showToast)
  const [busy, run] = useAction(onDone)
  const paid = dsa && PAID.includes(dsa.status)

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <span className="t">Daily subsistence allowance</span>
        {dsa?.status_label && <span className={`pill ${paid ? 't' : 'y'}`}>{dsa.status_label}</span>}
      </div>
      {!dsa ? (
        <span className="s">{covered ? 'Your DSA appears here once finance has processed your file. Upload your documents below first.' : 'Your registration does not include DSA.'}</span>
      ) : (
        <>
          <dl>
            {dsa.amount != null && <InfoRow label="Amount" value={money(dsa.amount, dsa.currency)} />}
            {dsa.days && dsa.daily_rate != null && <InfoRow label="Calculation" value={`${dsa.days} day${dsa.days === 1 ? '' : 's'} × ${money(dsa.daily_rate, dsa.currency)}`} />}
            {dsa.extras_total > 0 && <InfoRow label="Extra costs" value={money(dsa.extras_total, dsa.currency)} />}
            {dsa.reference && <InfoRow label="Reference" value={dsa.reference} />}
            {dsa.paid_at && <InfoRow label="Paid" value={formatDateTime(dsa.paid_at)} />}
          </dl>
          {dsa.notes && <span className="s whitespace-pre-line">{dsa.notes}</span>}
          {paid && dsa.has_proof && (
            <button type="button" className="btn o sm" onClick={() => openProtectedFile(`${base}/dsa/proof`, { title: 'DSA proof' }).catch((e) => showToast(e.message, 'info'))}>
              <Download size={16} aria-hidden="true" />Proof of payment
            </button>
          )}
          {paid && (dsa.receipt_confirmed ? (
            <div className="btn t sm">✓ You confirmed receipt{dsa.receipt_confirmed_at ? ` on ${formatDateTime(dsa.receipt_confirmed_at)}` : ''}</div>
          ) : (
            <button type="button" className="btn y sm" disabled={busy === 'ack'} onClick={() => run('ack', () => api(`${base}/dsa/acknowledge`, { method: 'POST', body: {} }), 'Thank you. Finance has been told.')}>
              I have received this DSA payment
            </button>
          ))}
        </>
      )}
    </Card>
  )
}

/** Travel claim, boarding pass, ticket and extra costs (visa fees, local transport). */
function DsaDocuments({ base, docs, onDone }) {
  const showToast = useAppStore((state) => state.showToast)
  const [busy, run] = useAction(onDone)
  const fileInput = useRef(null)
  const [target, setTarget] = useState(null)
  const [extra, setExtra] = useState({ category: 'visa', label: '', amount: '' })
  const [extraFile, setExtraFile] = useState(null)
  const files = [
    ['travel-claim', docs.has_claim, 'Travel claim', docs.claim_name],
    ['boarding-pass', docs.has_boarding_pass, 'Boarding pass', docs.boarding_pass_name],
    ...(docs.requires_ticket ? [['ticket', docs.has_ticket, 'Ticket', docs.ticket_name]] : []),
  ]

  function pick(kind) {
    setTarget(kind)
    fileInput.current?.click()
  }

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !target) return
    const body = new FormData()
    body.append('file', file)
    await run(target, () => api(`${base}/dsa/${target}`, { method: 'POST', body }), 'Uploaded. Finance will check it.')
  }

  async function addExtra(event) {
    event.preventDefault()
    if (!extraFile) return showToast('Attach the receipt first', 'info')
    const body = new FormData()
    body.append('category', extra.category)
    body.append('label', extra.label)
    if (extra.amount !== '') body.append('amount', extra.amount)
    body.append('file', extraFile)
    const ok = await run('extra', () => api(`${base}/dsa/extras`, { method: 'POST', body }), 'Extra cost added')
    if (ok) {
      setExtra({ category: 'visa', label: '', amount: '' })
      setExtraFile(null)
    }
  }

  return (
    <>
      <h2 className="h3">DSA documents</h2>
      <p className="s">Upload after you arrive. Finance checks them, then pays your DSA to your bank account.</p>
      {docs.info_request_note && <Card tone="yellow"><span className="t">Finance asked for more</span><span className="s">{docs.info_request_note}</span></Card>}
      <button type="button" className="btn o sm" onClick={() => openProtectedFile(`${base}/dsa/travel-claim-form`, { title: 'Travel claim form' }).catch((e) => showToast(e.message, 'info'))}>
        <Download size={16} aria-hidden="true" />Download the travel claim form
      </button>
      <div className={`grid gap-2 ${files.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {files.map(([kind, done, label, name]) => (
          <button key={kind} type="button" className={`tile ${done ? 'border-teal' : 'border-dashed border-maroon'}`} disabled={busy === kind} onClick={() => pick(kind)} title={name ?? undefined}>
            <span className={`dot ${done ? 'ok' : 'warn'} size-7`}>{done ? '✓' : '+'}</span>
            {busy === kind ? 'Uploading…' : label}
            {done && <span className="text-[10px] font-semibold text-muted">Replace</span>}
          </button>
        ))}
      </div>
      <input ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={upload} aria-hidden="true" tabIndex={-1} />

      <Card>
        <span className="t">Extra costs</span>
        <span className="s">Visa fees or local transport you paid yourself. Finance reviews each receipt.</span>
        {(docs.extras ?? []).map((item) => (
          <ListRow key={item.id}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="t">{item.label}</span>
              <span className="s">{[item.category_label, item.amount ? money(item.amount) : null, item.evidence_name].filter(Boolean).join(' · ')}</span>
            </span>
            {item.has_evidence && (
              <button type="button" className="text-maroon" aria-label={`Open receipt for ${item.label}`} onClick={() => openProtectedFile(`${base}/dsa/extras/${item.id}`, { title: item.label || 'Extra cost receipt' }).catch((e) => showToast(e.message, 'info'))}>
                <Download size={16} />
              </button>
            )}
          </ListRow>
        ))}
        <form onSubmit={addExtra} className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Type of cost" value={extra.category} onChange={(e) => setExtra({ ...extra, category: e.target.value })}>
              {EXTRA_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input aria-label="Amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="Amount" value={extra.amount} onChange={(e) => setExtra({ ...extra, amount: e.target.value })} />
          </div>
          <input aria-label="What it was for" required maxLength={160} placeholder="What it was for, e.g. Visa on arrival" value={extra.label} onChange={(e) => setExtra({ ...extra, label: e.target.value })} />
          <label className="btn o sm cursor-pointer">
            <Upload size={16} aria-hidden="true" />{extraFile ? extraFile.name : 'Attach the receipt'}
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setExtraFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" className="btn sm" disabled={busy === 'extra' || !extra.label.trim()}>{busy === 'extra' ? 'Adding…' : 'Add extra cost'}</button>
        </form>
      </Card>
    </>
  )
}

function BankDetails({ base, bank, required, onDone }) {
  const showToast = useAppStore((state) => state.showToast)
  const [editing, setEditing] = useState(required && !bank)
  const [form, setForm] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function open() {
    setEditing(true)
    try {
      const { bank_details: saved } = await api(`${base}/bank-details`)
      setForm(Object.fromEntries(BANK_FIELDS.map(([key]) => [key, saved?.[key] ?? ''])))
    } catch {
      setForm(Object.fromEntries(BANK_FIELDS.map(([key]) => [key, bank?.[key] ?? ''])))
    }
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`${base}/bank-details`, { method: 'PUT', body: form })
      showToast('Bank details saved')
      setEditing(false)
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card tone={required ? 'yellow' : ''} id="bank-details">
      <span className="t">Bank details for DSA</span>
      {required && <span className="s">Add your bank account so your DSA can be paid.</span>}
      {!editing && bank && (
        <dl>
          <InfoRow label="Account holder" value={bank.account_holder_name} />
          <InfoRow label="Bank" value={[bank.bank_name, bank.bank_country_label].filter(Boolean).join(' · ')} />
          <InfoRow label="Account" value={bank.account_number_masked} />
          <InfoRow label="SWIFT / routing" value={bank.has_routing_or_swift_code ? 'On file' : 'Missing'} />
        </dl>
      )}
      {!editing ? (
        <button type="button" className={`btn sm ${bank ? 'o' : ''}`} onClick={open}>{bank ? 'Update bank details' : 'Add bank details'}</button>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-2">
          {BANK_FIELDS.map(([key, label, needed]) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="lab" htmlFor={`bank-${key}`}>{label}{needed ? '' : ' (optional)'}</label>
              <input id={`bank-${key}`} required={needed} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} autoComplete="off" />
              {firstFieldError(error, key) && <span className="text-xs font-bold text-maroon">{firstFieldError(error, key)}</span>}
            </div>
          ))}
          {error && !Object.keys(error.fieldErrors ?? {}).length && <span className="text-xs font-bold text-maroon" role="alert">{error.message}</span>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn o sm" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="btn sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}
    </Card>
  )
}

function DsaQuery({ base, canQuery, opensAt, onDone }) {
  const [busy, run] = useAction(onDone)
  const [body, setBody] = useState('')
  if (!canQuery && !opensAt) return null

  return (
    <Card>
      <span className="t">Query your DSA payment</span>
      {canQuery ? (
        <>
          <span className="s">Payment not received, or the amount looks wrong? Finance replies in the desk chat below.</span>
          <textarea rows={2} maxLength={4000} aria-label="Your DSA query" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What is wrong with the payment?" />
          <button type="button" className="btn m sm" disabled={busy === 'query' || !body.trim()} onClick={() => run('query', () => api(`${base}/dsa/query`, { method: 'POST', body: { body } }).then(() => setBody('')), 'Query sent to finance')}>
            Send query to finance
          </button>
        </>
      ) : (
        <span className="s">You can query the payment from {formatDateTime(opensAt)}, seven days after it was paid.</span>
      )}
    </Card>
  )
}

/** Finance, as on the participant portal: fee, DSA, documents, extra costs, bank details, queries and the desk chat. */
export default function FinanceScreen() {
  const { registration, loading, error, reload } = useRegistration()
  const logistics = useLogistics(registration)
  const file = logistics.data
  const base = registration ? `/participant/registrations/${registration.id}` : ''
  const refresh = () => {
    logistics.reload()
    reload()
  }
  const showBank = Boolean(file?.dsa_covered || file?.bank_details)

  return (
    <>
      <ScreenHeader kicker="Finance" title="DSA and payments" back />
      <Body>
        <LoadState loading={loading || (logistics.loading && !file)} error={error ?? logistics.error} onRetry={refresh}>
          {registration && <RegistrationFee registration={registration} />}
          {file && (
            <>
              <InfoRequests base={base} requests={file.info_requests ?? []} onDone={refresh} />
              <DsaCard base={base} dsa={file.dsa} covered={file.dsa_covered} onDone={refresh} />
              {file.dsa_covered && file.dsa_documents && <DsaDocuments base={base} docs={file.dsa_documents} onDone={refresh} />}
              {showBank && <BankDetails base={base} bank={file.bank_details} required={file.bank_details_required} onDone={refresh} />}
              <DsaQuery base={base} canQuery={file.can_query_dsa} opensAt={file.dsa_query_opens_at} onDone={refresh} />
            </>
          )}
          <h2 className="h3">Message Travel & Finance</h2>
          <LogisticsThread placeholder="Ask finance about your DSA or payment" />
        </LoadState>
      </Body>
    </>
  )
}
