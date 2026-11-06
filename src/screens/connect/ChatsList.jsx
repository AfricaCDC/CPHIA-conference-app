import { LoadState } from '../../components/ui/LoadState'
import { listOf } from '../../lib/api'
import { formatRelative } from '../../lib/format'
import { useAppStore } from '../../store/appStore'
import { useSessionStore } from '../../store/sessionStore'
import { PersonRow } from './Directory'

export default function ChatsList({ remote }) {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const userId = useSessionStore((state) => state.user?.id)
  const chats = listOf(remote.data)

  return (
    <LoadState loading={remote.loading && !chats.length} error={remote.error} onRetry={remote.reload}>
      {chats.length === 0 && (
        <p className="text-subtle py-4 text-center text-sm">No chats yet. Open a delegate in People and tap Message to start one.</p>
      )}
      <ul className="space-y-2">
        {chats.map((chat) => {
          const person = chat.participant ?? { name: 'Delegate' }
          const last = chat.last_message
          const preview = last ? `${last.sender_id === userId ? 'You: ' : ''}${last.body}` : 'No messages yet'
          return (
            <li key={chat.id}>
              <PersonRow
                person={person}
                subtitle={preview}
                onClick={() => navigateTo('chat', { id: chat.id, name: person.name, photo: person.photo_url ?? null })}
                trailing={
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {last && <time className="text-subtle text-xs" dateTime={last.created_at}>{formatRelative(last.created_at)}</time>}
                    {chat.unread_count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-maroon px-1 text-[11px] font-bold text-white">{chat.unread_count}</span>}
                  </span>
                }
              />
            </li>
          )
        })}
      </ul>
    </LoadState>
  )
}
