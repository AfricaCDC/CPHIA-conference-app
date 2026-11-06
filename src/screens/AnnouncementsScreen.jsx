import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import { LoadState } from '../components/ui/LoadState'
import ScreenHeader, { Body } from '../components/ui/ScreenHeader'
import { formatRelative } from '../lib/format'
import { useEventSlug } from '../lib/useParticipant'
import { useRemote } from '../lib/useRemote'

const TYPE = {
  info: { label: 'Info', tone: 'teal', border: '' },
  success: { label: 'Update', tone: 'teal', border: '' },
  warning: { label: 'Important', tone: 'sun', border: 'border-l-4 border-l-sun' },
  urgent: { label: 'Urgent', tone: 'maroon', border: 'border-l-4 border-l-maroon' },
}

export default function AnnouncementsScreen() {
  const slug = useEventSlug()
  const { data, loading, error, reload } = useRemote(`/events/${encodeURIComponent(slug)}/announcements`)
  const items = data?.data ?? []

  return (
    <>
      <ScreenHeader kicker="Announcements" title="From the organisers" back />
      <Body>
    <LoadState loading={loading && !items.length} error={error} onRetry={reload}>
      {items.length === 0 && <p className="text-subtle py-6 text-center text-sm">No announcements yet.</p>}
      <ul className="space-y-2">
        {items.map((item) => {
          const type = TYPE[item.type] ?? TYPE.info
          return (
            <li key={item.id}>
              <Card className={type.border}>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={type.tone}>{type.label}</Badge>
                  {item.published_at && <time className="text-subtle text-xs" dateTime={item.published_at}>{formatRelative(item.published_at)}</time>}
                </div>
                <h2 className="t">{item.title}</h2>
                <p className="text-subtle whitespace-pre-line text-sm">{item.body}</p>
              </Card>
            </li>
          )
        })}
      </ul>
    </LoadState>
      </Body>
    </>
  )
}
