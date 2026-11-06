import { useState } from 'react'
import { Send } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { api, listOf } from '../../lib/api'
import { formatRelative } from '../../lib/format'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

export default function LoungeFeedScreen({ params }) {
    const slug = useEventSlug()
    const showToast = useAppStore((state) => state.showToast)
    const path = `/events/${encodeURIComponent(slug)}/lounge/channels/${params.channelId}/posts`
    const { data, loading, error, reload } = useRemote(path)
    const [draft, setDraft] = useState('')
    const [sending, setSending] = useState(false)
    const posts = listOf(data)

    async function post(event) {
        event.preventDefault()
        const body = draft.trim()
        if (!body) return
        setSending(true)
        try {
            await api(path, { method: 'POST', body: { body } })
            setDraft('')
            reload()
        } catch (err) {
            showToast(err.message, 'info')
        } finally {
            setSending(false)
        }
    }

    return (
        <>
            <ScreenHeader kicker="Lounge" title={`# ${data?.data?.channel?.name ?? params.name ?? ''}`} back />
            <Body>
                <form onSubmit={post} className="space-y-2">
                    <label htmlFor="lounge-post" className="sr-only">
                        Write a post
                    </label>
                    <textarea id="lounge-post" rows={3} maxLength={5000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Share something with all delegates" />
                    <Button type="submit" icon={Send} className="w-full" disabled={sending || !draft.trim()}>
                        {sending ? 'Posting…' : 'Post'}
                    </Button>
                </form>
                <LoadState loading={loading && !posts.length} error={error} onRetry={reload}>
                    {posts.length === 0 && <p className="text-subtle py-4 text-center text-sm">No posts yet. Start the conversation.</p>}
                    <ul className="space-y-2">
                        {posts.map((item) => (
                            <li key={item.id}>
                                <Card className="row items-start">
                                    <Avatar name={item.author?.name} photoUrl={item.author?.photo_url} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <p className="flex items-baseline justify-between gap-2">
                                            <span className="truncate text-sm font-bold">{item.author?.name ?? 'Delegate'}</span>
                                            <time className="text-subtle shrink-0 text-xs" dateTime={item.created_at}>
                                                {formatRelative(item.created_at)}
                                            </time>
                                        </p>
                                        <p className="whitespace-pre-line break-words text-sm">{item.body}</p>
                                    </div>
                                </Card>
                            </li>
                        ))}
                    </ul>
                </LoadState>
            </Body>
        </>
    )
}
