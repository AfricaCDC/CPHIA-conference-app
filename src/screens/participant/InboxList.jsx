import { CardButton } from '../../components/ui/Card'
import { CheckCheck } from 'lucide-react'
import Button from '../../components/ui/Button'
import { LoadState } from '../../components/ui/LoadState'
import { api } from '../../lib/api'
import { formatRelative } from '../../lib/format'
import { useInbox } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

const SCREENS = new Set(['messages', 'travel', 'accommodation', 'transport', 'badge', 'announcements'])

export default function InboxList() {
  const { items, unread, loading, error, reload } = useInbox()
  const navigateTo = useAppStore((state) => state.navigateTo)

  async function open(item) {
    if (!item.read_at) await api(`/participant/notifications/${item.id}/read`, { method: 'POST' }).catch(() => {})
    if (item.screen && item.screen !== 'messages' && SCREENS.has(item.screen)) navigateTo(item.screen)
    else reload()
  }

  async function markAllRead() {
    await api('/participant/notifications/read-all', { method: 'POST' })
    reload()
  }

  return (
    <LoadState loading={loading && !items.length} error={error} onRetry={reload}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-subtle text-sm">Every action on your registration, also sent as a push notification. {unread > 0 ? `${unread} unread.` : 'All read.'}</p>
        {unread > 0 && <Button size="sm" variant="ghost" icon={CheckCheck} className="shrink-0 whitespace-nowrap" onClick={markAllRead}>Mark all read</Button>}
      </div>
      {items.length === 0 && <p className="text-subtle py-6 text-center text-sm">No updates yet. They will appear here as the teams act on your registration.</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <CardButton onClick={() => open(item)} className="row w-full items-start text-left">
              <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${item.read_at ? 'bg-transparent' : 'bg-maroon'}`} aria-label={item.read_at ? undefined : 'Unread'} />
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className={item.read_at ? 'font-semibold' : 'font-extrabold'}>{item.title}</span>
                  <time className="text-subtle shrink-0 text-xs" dateTime={item.created_at}>{formatRelative(item.created_at)}</time>
                </span>
                <span className="text-subtle line-clamp-2 text-sm">{item.body}</span>
              </span>
            </CardButton>
          </li>
        ))}
      </ul>
    </LoadState>
  )
}
