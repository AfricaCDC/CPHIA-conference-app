import { Hash } from 'lucide-react'
import { LinkCard } from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import { listOf } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

/** Community lounge: open channels where every delegate can post. */
export default function LoungeChannels() {
  const slug = useEventSlug()
  const navigateTo = useAppStore((state) => state.navigateTo)
  const { data, loading, error, reload } = useRemote(`/events/${encodeURIComponent(slug)}/lounge/channels`)
  const channels = listOf(data)

  return (
    <LoadState loading={loading} error={error} onRetry={reload}>
      <p className="s">Open discussion with all delegates. Posts are visible to everyone at the conference.</p>
      {channels.length === 0 && <p className="text-subtle py-4 text-center text-sm">No lounge channels yet.</p>}
      <ul className="space-y-2">
        {channels.map((channel) => (
          <li key={channel.id}>
            <LinkCard
              icon={Hash}
              title={channel.name}
              subtitle={channel.description ?? `${channel.post_count ?? 0} posts`}
              onClick={() => navigateTo('lounge', { channelId: channel.id, name: channel.name })}
            />
          </li>
        ))}
      </ul>
    </LoadState>
  )
}
