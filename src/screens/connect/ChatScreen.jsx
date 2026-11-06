import { useCallback, useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useEventSlug } from '../../lib/useParticipant'
import { useRefreshListener } from '../../lib/useRefreshListener'
import { useAppStore } from '../../store/appStore'
import { useSessionStore } from '../../store/sessionStore'

const POLL_MS = 5000

/** 1:1 delegate chat. Polls for new messages while open (push covers the app being closed). */
export default function ChatScreen({ params }) {
    const slug = useEventSlug()
    const userId = useSessionStore((state) => state.user?.id)
    const showToast = useAppStore((state) => state.showToast)
    const base = `/events/${encodeURIComponent(slug)}/conversations/${params.id}`
    const [messages, setMessages] = useState([])
    const [hasMoreBefore, setHasMoreBefore] = useState(false)
    const [state, setState] = useState({ loading: true, error: null })
    const [draft, setDraft] = useState('')
    const [sending, setSending] = useState(false)
    const bottomRef = useRef(null)
    const newestId = messages.at(-1)?.id ?? 0

    const markRead = useCallback(() => api(`${base}/read`, { method: 'POST' }).catch(() => {}), [base])

    const loadLatest = useCallback(async () => {
        try {
            const { data } = await api(`${base}/messages`)
            setMessages(data.items)
            setHasMoreBefore(Boolean(data.has_more_before))
            setState({ loading: false, error: null })
            markRead()
        } catch (error) {
            setState({ loading: false, error })
        }
    }, [base, markRead])

    useEffect(() => {
        loadLatest()
    }, [loadLatest])

    useRefreshListener(() => {
        loadLatest()
    })

    useEffect(() => {
        if (state.loading || state.error) return undefined
        const timer = setInterval(async () => {
            if (document.hidden) return
            const { data } = await api(`${base}/messages?after_id=${newestId}`).catch(() => ({ data: { items: [] } }))
            if (data.items.length) {
                setMessages((previous) => [...previous, ...data.items.filter((item) => !previous.some((p) => p.id === item.id))])
                markRead()
            }
        }, POLL_MS)
        return () => clearInterval(timer)
    }, [base, newestId, state, markRead])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' })
    }, [newestId])

    async function loadOlder() {
        const { data } = await api(`${base}/messages?before_id=${messages[0].id}`)
        setMessages((previous) => [...data.items, ...previous])
        setHasMoreBefore(Boolean(data.has_more_before))
    }

    async function send(event) {
        event.preventDefault()
        const body = draft.trim()
        if (!body) return
        setSending(true)
        try {
            const { data } = await api(`${base}/messages`, { method: 'POST', body: { body } })
            setMessages((previous) => [...previous, data])
            setDraft('')
        } catch (err) {
            showToast(err.message, 'info')
        } finally {
            setSending(false)
        }
    }

    return (
        <>
            <ScreenHeader kicker="Message" title={params.name ?? 'Chat'} back right={<Avatar name={params.name} photoUrl={params.photo} />} />
            <Body>
                <p className="s">Messages are visible to the conference platform team. Do not share passwords or payment details.</p>
                <LoadState loading={state.loading} error={state.error} onRetry={loadLatest}>
                    {hasMoreBefore && (
                        <Button size="sm" variant="ghost" className="w-full" onClick={loadOlder}>
                            Load earlier messages
                        </Button>
                    )}
                    {messages.length === 0 && <p className="text-subtle py-4 text-center text-sm">Say hello 👋</p>}
                    <ul className="space-y-2" aria-label="Messages" aria-live="polite">
                        {messages.map((message) => {
                            const mine = message.sender_id === userId
                            return (
                                <li key={message.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${mine ? 'ml-auto bg-ink text-cream' : 'border border-line bg-white'}`}>
                                    <p className="whitespace-pre-line break-words">{message.body}</p>
                                    <time className={`mt-1 block text-xs ${mine ? 'text-cream/70' : 'text-subtle'}`} dateTime={message.created_at}>
                                        {formatDateTime(message.created_at)}
                                    </time>
                                </li>
                            )
                        })}
                    </ul>
                    <div ref={bottomRef} />
                    <form onSubmit={send} className="sticky bottom-24 flex items-end gap-2 rounded-[14px] border border-line bg-white p-2 shadow-lg">
                        <label htmlFor="chat-message" className="sr-only">
                            Message
                        </label>
                        <textarea
                            id="chat-message"
                            rows={1}
                            maxLength={5000}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Write a message"
                            className="max-h-32 min-h-11 flex-1 resize-y border-0 bg-transparent p-2 outline-none"
                        />
                        <Button type="submit" icon={Send} aria-label="Send" disabled={sending || !draft.trim()} />
                    </form>
                </LoadState>
            </Body>
        </>
    )
}
