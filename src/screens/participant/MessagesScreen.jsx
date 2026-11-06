import { useState } from 'react'
import ScreenHeader, { Body, Chips } from '../../components/ui/ScreenHeader'
import ChatsList from '../connect/ChatsList'
import InboxList from './InboxList'
import LogisticsThread from './LogisticsThread'
import { listOf } from '../../lib/api'
import { useEventSlug, useInbox } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'

/**
 * Messages: 1:1 chats with other delegates, updates pushed by the desks (ticket, hotel,
 * badge, transport…) and the conversation with the Travel & Finance desks.
 */
export default function MessagesScreen({ params }) {
  const [tab, setTab] = useState(params.tab ?? 'chats')
  const slug = useEventSlug()
  const chats = useRemote(`/events/${encodeURIComponent(slug)}/conversations`)
  const { unread } = useInbox()
  const chatUnread = listOf(chats.data).reduce((sum, chat) => sum + (chat.unread_count ?? 0), 0)
  const count = (n) => (n > 0 ? ` (${n})` : '')

  return (
    <>
      <ScreenHeader kicker="Messages" title="Chats, updates and desks" back>
        <Chips
          label="Messages"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'chats', label: `Chats${count(chatUnread)}` },
            { id: 'updates', label: `Updates${count(unread)}` },
            { id: 'desks', label: 'Travel & Finance desks' },
          ]}
        />
      </ScreenHeader>
      <Body>
        {tab === 'chats' && <ChatsList remote={chats} />}
        {tab === 'updates' && <InboxList />}
        {tab === 'desks' && <LogisticsThread />}
      </Body>
    </>
  )
}
