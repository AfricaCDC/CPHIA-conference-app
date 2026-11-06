import Card from '../../components/ui/Card'
import { useCallback, useState } from 'react'
import { QrCode } from 'lucide-react'
import ScreenHeader, { Body, Chips } from '../../components/ui/ScreenHeader'
import ChatsList from './ChatsList'
import Directory from './Directory'
import SearchField from '../../components/ui/SearchField'
import LoungeChannels from './LoungeChannels'
import { listOf } from '../../lib/api'
import { useEventSlug, useRegistration } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

/** Connect and meet: registered delegates, my connections, chats and the lounge. */
export default function ConnectScreen({ params }) {
  const [tab, setTab] = useState(params.tab ?? 'all')
  const [query, setQuery] = useState('')
  const [total, setTotal] = useState(null)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const slug = useEventSlug()
  const { registration } = useRegistration()
  const chats = useRemote(`/events/${encodeURIComponent(slug)}/conversations`)
  const unreadChats = listOf(chats.data).reduce((sum, chat) => sum + (chat.unread_count ?? 0), 0)
  const onTotal = useCallback((n) => setTotal((current) => (current === null || n > current ? n : current)), [])
  const showsPeople = tab === 'all' || tab === 'mine'

  return (
    <>
      <ScreenHeader
        kicker="Connect and meet"
        title="Registered delegates"
        right={<button type="button" className="btn y sm" onClick={() => navigateTo('card')}><QrCode size={16} aria-hidden="true" />My card</button>}
      >
        {showsPeople && <SearchField label="Search delegates" value={query} onChange={setQuery} placeholder="Name, organisation, job title" />}
        <Chips
          label="Show"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'all', label: total ? `All ${total.toLocaleString()}` : 'All' },
            { id: 'mine', label: 'My connections' },
            { id: 'chats', label: unreadChats ? `Messages (${unreadChats})` : 'Messages' },
            { id: 'lounge', label: 'Lounge' },
          ]}
        />
      </ScreenHeader>
      <Body>
        {showsPeople && (
          <Card className={`card row ${registration?.networking_visible ? 'mint' : 'yellow'}`}>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="t">
                {!registration
                  ? 'Staff directory access'
                  : registration.networking_visible
                    ? 'Visible to other participants'
                    : 'Hidden from other participants'}
              </span>
              <span className="s">
                {!registration
                  ? 'You can browse and message connections. Delegates also need networking visibility in their profile.'
                  : 'Name, organisation, job title, interests. Contact details are shared only when you exchange cards.'}
              </span>
            </span>
            {registration && <button type="button" className="btn o sm" onClick={() => navigateTo('profile')}>Change</button>}
          </Card>
        )}
        {showsPeople && <Directory query={query} filter={tab} onTotal={onTotal} />}
        {tab === 'chats' && <ChatsList remote={chats} />}
        {tab === 'lounge' && <LoungeChannels />}
        <p className="foot">Meet in person? Scan each other’s badge QR to connect instantly.</p>
      </Body>
    </>
  )
}
