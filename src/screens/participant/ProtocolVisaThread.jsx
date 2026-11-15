import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import Card from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import { api, firstFieldError } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useEventSlug, useRegistration } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

const POLL_MS = 15000

/**
 * Conversation with the Protocol desk about Ethiopia visa support.
 * Used on Messages → Protocol and embedded under the Visa status card.
 */
export default function ProtocolVisaThread({
  compact = false,
  showStartPrompt = true,
}) {
  const slug = useEventSlug()
  const { registration, loading: loadingRegistration, error: registrationError } = useRegistration()
  const showToast = useAppStore((state) => state.showToast)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const path = `/events/${encodeURIComponent(slug)}/participant/ethiopia-visa`
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [startNote, setStartNote] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  async function load() {
    setError(null)
    try {
      const res = await api(path)
      setData(res)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!data?.applies) return undefined
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [data?.applies, slug]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [data?.messages?.length])

  if (!loadingRegistration && !registrationError && !registration) {
    return <div className="empty">No registration found for this conference.</div>
  }

  if (loading && !data) {
    return <LoadState loading />
  }

  if (error && !data) {
    return <LoadState error={error} onRetry={load} />
  }

  if (!data?.applies) {
    return (
      <Card>
        <span className="t">Protocol visa desk</span>
        <span className="s">Ethiopia visa support does not apply to your registration (for example Ethiopian nationals).</span>
      </Card>
    )
  }

  const messages =
    data.messages?.length > 0
      ? data.messages
      : data.support_note
        ? [{ id: 0, sender: 'participant', body: data.support_note, created_at: data.updated_at }]
        : []

  const open = data.status === 'needs_support'

  async function startSupport(event) {
    event.preventDefault()
    const text = startNote.trim()
    if (!text) return
    setSending(true)
    try {
      const res = await api(path, {
        method: 'PUT',
        body: { status: 'needs_support', support_note: text },
      })
      setData(res)
      setStartNote('')
      showToast('Sent to the protocol team')
    } catch (err) {
      showToast(firstFieldError(err, 'support_note') || err.message, 'info')
    } finally {
      setSending(false)
    }
  }

  async function send(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSending(true)
    try {
      const res = await api(`${path}/messages`, { method: 'POST', body: { body: text } })
      setData(res)
      setDraft('')
      showToast('Sent to the protocol team')
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={compact ? '' : 'flex flex-col gap-3'}>
      {!compact && (
        <Card tone={open && !data.support_resolved_at ? 'yellow' : 'mint'}>
          <span className="t">Protocol · Visa to Ethiopia</span>
          <span className="s">
            {open
              ? (data.support_resolved_at
                ? 'Marked resolved — you can still send a follow-up if you need more help.'
                : 'Your request is with the protocol team. They reply here and by email.')
              : 'Message protocol about e-visa, embassy, note verbale or arrival.'}
          </span>
          {data.status_label && (
            <span className="pill t mt-1 inline-flex self-start">{data.status_label}</span>
          )}
          {!open && (
            <button type="button" className="btn o sm mt-2" onClick={() => navigateTo('visa')}>
              Open Visa status
            </button>
          )}
        </Card>
      )}

      {!open && showStartPrompt && (
        <form onSubmit={startSupport} className="flex flex-col gap-2 rounded-[14px] border border-line bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Start a protocol request</p>
          <label htmlFor="protocol-start" className="sr-only">What do you need help with?</label>
          <textarea
            id="protocol-start"
            rows={3}
            maxLength={2000}
            value={startNote}
            onChange={(e) => setStartNote(e.target.value)}
            placeholder="Tell protocol what is blocking your visa"
            className="w-full resize-y rounded-[12px] border border-line bg-white p-2 text-sm outline-none"
          />
          <button type="submit" className="btn" disabled={sending || !startNote.trim()}>
            {sending ? 'Sending…' : 'Message protocol'}
          </button>
        </form>
      )}

      {open && (
        <>
          {messages.length === 0 && (
            <div className="empty">No messages yet. Protocol will reply here and by email.</div>
          )}
          <div className="tt-chat" role="log" aria-label="Conversation with protocol" aria-live="polite">
            {messages.map((m) => {
              const mine = m.sender === 'participant'
              return (
                <div
                  key={`${m.id}-${m.created_at}`}
                  className={`tt-chat-bubble ${mine ? 'tt-chat-bubble--traveller' : 'tt-chat-bubble--agent'}`}
                >
                  <div className="tt-chat-bubble__meta">
                    <strong>{mine ? 'You' : (m.sender_label || 'Protocol')}</strong>
                    <span>{formatDateTime(m.created_at)}</span>
                  </div>
                  <div className="tt-chat-bubble__body whitespace-pre-line">{m.body}</div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
          {data.can_message && (
            <form onSubmit={send} className="mt-2 flex items-end gap-2 rounded-[14px] border border-line bg-white p-2">
              <label htmlFor="protocol-message" className="sr-only">Message the protocol team</label>
              <textarea
                id="protocol-message"
                rows={1}
                maxLength={2000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message the protocol team"
                className="max-h-32 min-h-11 flex-1 resize-y border-0 bg-transparent p-2 outline-none"
              />
              <button type="submit" className="btn sm h-11" disabled={sending || !draft.trim()} aria-label="Send">
                <Send size={18} aria-hidden="true" />
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
