import { useEffect, useState } from 'react'
import ScreenHeader, { Body, Chips } from '../../components/ui/ScreenHeader'
import ChatsList from '../connect/ChatsList'
import InboxList from './InboxList'
import LogisticsThread from './LogisticsThread'
import ProtocolVisaThread from './ProtocolVisaThread'
import { listOf } from '../../lib/api'
import { useEventSlug, useInbox } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'

const DESK_OPTS = [
  { id: 'travel', label: 'Travel & Finance' },
  { id: 'protocol', label: 'Protocol · Visa' },
]

/**
 * Messages: delegate chats, desk updates, and separate desk threads
 * (Travel & Finance vs Protocol visa support).
 */
export default function MessagesScreen({ params }) {
  const initialTab = params.tab === 'desks' || params.desk ? 'desks' : (params.tab ?? 'chats')
  const [tab, setTab] = useState(initialTab)
  const [desk, setDesk] = useState(params.desk === 'protocol' ? 'protocol' : 'travel')
  const slug = useEventSlug()
  const chats = useRemote(`/events/${encodeURIComponent(slug)}/conversations`)
  const { unread } = useInbox()
  const chatUnread = listOf(chats.data).reduce((sum, chat) => sum + (chat.unread_count ?? 0), 0)
  const count = (n) => (n > 0 ? ` (${n})` : '')

  useEffect(() => {
    if (params.tab) setTab(params.tab === 'desks' || params.desk ? 'desks' : params.tab)
    if (params.desk === 'protocol' || params.desk === 'travel') setDesk(params.desk)
  }, [params.tab, params.desk])

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
            { id: 'desks', label: 'Desks' },
          ]}
        />
      </ScreenHeader>
      <Body>
        {tab === 'chats' && <ChatsList remote={chats} />}
        {tab === 'updates' && <InboxList />}
        {tab === 'desks' && (
          <div className="flex flex-col gap-3">
            <Chips label="Desk" options={DESK_OPTS} value={desk} onChange={setDesk} light />
            {desk === 'travel' ? (
              <>
                <p className="text-xs font-semibold text-muted">
                  Ticket, hotel, DSA and travel partner — separate from protocol visa support.
                </p>
                <LogisticsThread placeholder="Ask Travel & Finance about your ticket, hotel or DSA" />
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-muted">
                  Ethiopia visa support with the protocol team — e-visa, embassy, note verbale, arrival.
                </p>
                <ProtocolVisaThread />
              </>
            )}
          </div>
        )}
      </Body>
    </>
  )
}
