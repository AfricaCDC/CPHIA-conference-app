import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import Card from '../../components/ui/Card'
import { api, firstFieldError } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useEventSlug } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

/**
 * “Do you have an active visa to Ethiopia?” + ticketing-style support chat.
 */
export default function EthiopiaVisaCard() {
  const slug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const path = `/events/${encodeURIComponent(slug)}/participant/ethiopia-visa`
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [choice, setChoice] = useState(null)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  async function load() {
    setError(null)
    try {
      const res = await api(path)
      setData(res)
      setChoice(res?.status ?? null)
      setNote(res?.support_note ?? '')
      if (!res?.status) setEditing(true)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [data?.messages?.length])

  if (loading && !data) return <Card><span className="s">Loading visa status…</span></Card>
  if (error && !data) return null
  if (!data?.applies) return null

  const messages =
    (data.messages?.length > 0)
      ? data.messages
      : data.support_note
        ? [{ id: 0, sender: 'participant', body: data.support_note, created_at: data.updated_at, sender_label: 'You' }]
        : []

  async function save() {
    if (!choice) return
    setBusy(true)
    try {
      const body = { status: choice }
      if (choice === 'needs_support') body.support_note = note.trim()
      const res = await api(path, { method: 'PUT', body })
      setData(res)
      setEditing(false)
      showToast('Visa status saved')
    } catch (err) {
      showToast(firstFieldError(err, 'support_note') || err.message, 'info')
    } finally {
      setBusy(false)
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
      showToast('Message sent to protocol')
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card tone={data.status === 'needs_support' && !data.support_resolved_at ? 'yellow' : undefined}>
      <span className="t">Visa to Ethiopia</span>
      <span className="s">Do you have an active visa to Ethiopia?</span>

      {!editing && data.status ? (
        <>
          <p className="text-sm font-bold text-ink">{data.status_label}</p>
          <button type="button" className="btn o sm" onClick={() => setEditing(true)}>Update answer</button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {(data.options ?? []).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="radio"
                name="ethiopia-visa"
                checked={choice === opt.value}
                onChange={() => setChoice(opt.value)}
              />
              {opt.label}
            </label>
          ))}
          {choice === 'needs_support' && (
            <textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell protocol what you need help with"
              className="w-full rounded-[12px] border border-line bg-white p-2 text-sm"
            />
          )}
          <button
            type="button"
            className="btn"
            disabled={busy || !choice || (choice === 'needs_support' && !note.trim())}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {data.status === 'needs_support' && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="lab mb-2">Conversation with protocol</p>
          <div className="tt-chat" role="log">
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
              <label htmlFor="ethiopia-visa-msg" className="sr-only">Message protocol</label>
              <textarea
                id="ethiopia-visa-msg"
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
        </div>
      )}
    </Card>
  )
}
