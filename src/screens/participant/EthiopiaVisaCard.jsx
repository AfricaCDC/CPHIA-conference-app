import { useEffect, useState } from 'react'
import Card from '../../components/ui/Card'
import { api, firstFieldError } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'
import ProtocolVisaThread from './ProtocolVisaThread'

/**
 * “Do you have an active visa to Ethiopia?” + protocol support chat.
 */
export default function EthiopiaVisaCard() {
  const slug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const path = `/events/${encodeURIComponent(slug)}/participant/ethiopia-visa`
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [choice, setChoice] = useState(null)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [threadKey, setThreadKey] = useState(0)

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

  if (loading && !data) return <Card><span className="s">Loading visa status…</span></Card>
  if (error && !data) return null
  if (!data?.applies) return null

  async function save() {
    if (!choice) return
    setBusy(true)
    try {
      const body = { status: choice }
      if (choice === 'needs_support') body.support_note = note.trim()
      const res = await api(path, { method: 'PUT', body })
      setData(res)
      setEditing(false)
      setThreadKey((k) => k + 1)
      showToast(choice === 'needs_support' ? 'Sent to protocol — you can keep messaging below' : 'Visa status saved')
    } catch (err) {
      showToast(firstFieldError(err, 'support_note') || err.message, 'info')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card tone={data.status === 'needs_support' && !data.support_resolved_at ? 'yellow' : undefined}>
      <span className="t">Visa to Ethiopia</span>
      <span className="s">Do you have an active visa to Ethiopia?</span>

      {!editing && data.status ? (
        <>
          <p className="text-sm font-bold text-ink">{data.status_label}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn o sm" onClick={() => setEditing(true)}>Update answer</button>
            {data.status === 'needs_support' && (
              <button
                type="button"
                className="btn sm"
                onClick={() => navigateTo('messages', { tab: 'desks', desk: 'protocol' })}
              >
                Open in Messages
              </button>
            )}
          </div>
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
            {busy ? 'Saving…' : (choice === 'needs_support' ? 'Send to protocol' : 'Save')}
          </button>
        </div>
      )}

      {(data.status === 'needs_support' || choice === 'needs_support') && !editing && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="lab mb-2">Conversation with protocol</p>
          <ProtocolVisaThread key={threadKey} compact showStartPrompt={false} />
        </div>
      )}
    </Card>
  )
}
