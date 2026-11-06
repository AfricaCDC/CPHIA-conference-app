import Card from '../../components/ui/Card'
import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { LoadState } from '../../components/ui/LoadState'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useLogistics, useRegistration } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

const SENDER_LABEL = { partner: 'Travel & Finance', admin: 'CPHIA secretariat' }
const POLL_MS = 15000

/**
 * Chat with the Travel & Finance desks (logistics messages). Used in Messages, Finance and Ticket.
 * `topic` prefixes a new message, e.g. "[DSA]", so the desk sees what it is about.
 */
export default function LogisticsThread({ topic = null, placeholder = 'Ask about your ticket, visa, hotel or DSA' }) {
  const { registration, loading: loadingRegistration, error: registrationError } = useRegistration()
  const path = registration ? `/participant/registrations/${registration.id}/logistics/messages` : null
  const { data, loading, error, reload } = useRemote(path)
  const logistics = useLogistics(registration)
  const showToast = useAppStore((state) => state.showToast)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const messages = data?.data ?? []
  const enabled = logistics.data ? Boolean(logistics.data.messaging_enabled) : true

  // Keep the thread fresh while it is open; replies also arrive as push notifications.
  useEffect(() => {
    if (!path) return undefined
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [path, reload])

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  async function send(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSending(true)
    try {
      await api(path, { method: 'POST', body: { body: topic ? `${topic} ${text}` : text } })
      setDraft('')
      showToast('Sent to the Travel & Finance desks')
      reload()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setSending(false)
    }
  }

  if (!loadingRegistration && !registrationError && !registration) {
    return <div className="empty">No registration found for this conference.</div>
  }

  return (
    <LoadState loading={loadingRegistration || (loading && !messages.length)} error={registrationError ?? error} onRetry={reload}>
      {messages.length === 0 && <div className="empty">No messages yet. The Travel & Finance desks answer here and by email.</div>}
      <ul className="flex flex-col gap-2" aria-label="Conversation with the Travel & Finance desks" aria-live="polite">
        {messages.map((message) => {
          const mine = message.sender_type === 'participant'
          return (
            <li key={message.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${mine ? 'ml-auto bg-ink text-cream' : 'border border-line bg-white'}`}>
              {!mine && <p className="mb-1 text-xs font-extrabold text-teal-dark">{message.sender_name ?? SENDER_LABEL[message.sender_type] ?? 'Desk'}</p>}
              <p className="whitespace-pre-line break-words">{message.body}</p>
              <time className={`mt-1 block text-[11px] ${mine ? 'text-cream/70' : 'text-muted'}`} dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>
            </li>
          )
        })}
      </ul>
      <div ref={bottomRef} />
      {enabled ? (
        <form onSubmit={send} className="flex items-end gap-2 rounded-[14px] border border-line bg-white p-2">
          <label htmlFor="desk-message" className="sr-only">Message the Travel & Finance desks</label>
          <textarea id="desk-message" rows={1} maxLength={4000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="max-h-32 min-h-11 flex-1 resize-y border-0 bg-transparent p-2 outline-none" />
          <button type="submit" className="btn sm h-11" aria-label="Send" disabled={sending || !draft.trim()}><Send size={18} aria-hidden="true" /></button>
        </form>
      ) : (
        <Card className="card mint">
          <span className="t">Messaging opens soon</span>
          <span className="s">You can message the desks once a travel partner is assigned to your file. Until then, updates still reach you here and by email.</span>
        </Card>
      )}
    </LoadState>
  )
}
