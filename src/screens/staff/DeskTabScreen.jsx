import Card from '../../components/ui/Card'
import ListRow from '../../components/ui/ListRow'
import { ExternalLink } from 'lucide-react'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { VenueBoards } from '../participant/VenuesScreen'
import DispatchScreen from './DispatchScreen'
import HotelDeskScreen from './HotelDeskScreen'
import TransportDeskScreen from './TransportDeskScreen'
import ProtocolMovementsScreen from './ProtocolMovementsScreen'
import { listOf } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useDesk, useRoles } from '../../lib/roles'

function Groups() {
  const slug = useEventSlug()
  const { canViewGroups } = useRoles()
  const { data, loading, error, reload } = useRemote(canViewGroups ? `/events/${encodeURIComponent(slug)}/groups?per_page=100` : null)
  const groups = listOf(data)

  if (!canViewGroups) {
    return <Card className="card yellow"><span className="t">Groups are not on for your account</span><span className="s">Ask an admin to add the groups permission to your role.</span></Card>
  }
  return (
    <LoadState loading={loading} error={error} onRetry={reload}>
      <Card className="card gap-0">
        {groups.length === 0 && <div className="empty">No groups yet.</div>}
        {groups.map((group) => (
          <ListRow key={group.id}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="t">{group.name}</span>
              <span className="s">{[group.type_label, group.organization, `${group.registrations_count} members`, `${group.cleared_registrations_count} cleared`].filter(Boolean).join(' · ')}</span>
            </span>
            {group.request_status_label && <span className="pill">{group.request_status_label}</span>}
          </ListRow>
        ))}
      </Card>
    </LoadState>
  )
}

/** The desk's own tab (fourth tab): Venue, Groups, or the desk queue in the Event Management Center. */
export default function DeskTabScreen() {
  const desk = useDesk()
  if (!desk) return null
  const { tab } = desk

  return (
    <>
      <ScreenHeader kicker={desk.kicker} title={tab.label} tone="teal" />
      <Body>
        {tab.kind === 'venue' && <VenueBoards />}
        {tab.kind === 'groups' && <Groups />}
        {tab.kind === 'dispatch' && <DispatchScreen />}
        {tab.kind === 'transport' && tab.desk === 'hotel' && <HotelDeskScreen />}
        {tab.kind === 'transport' && tab.desk !== 'hotel' && <TransportDeskScreen desk={tab.desk} />}
        {tab.kind === 'movements' && (
          <>
            <h2 className="h3">VIP movements</h2>
            <ProtocolMovementsScreen />
            <h2 className="h3">Arrivals</h2>
            <TransportDeskScreen desk="protocol" />
          </>
        )}
        {tab.kind === 'web' && (
          <Card className="card">
            <span className="t">{tab.label}</span>
            <span className="s">This queue lives in the Event Management Center, with filters, history and bulk actions.</span>
            {desk.web_url ? (
              <a className="btn" href={desk.web_url} target="_blank" rel="noopener noreferrer">Open {tab.label} <ExternalLink size={15} aria-hidden="true" /></a>
            ) : (
              <span className="s">Ask an admin for access to this desk.</span>
            )}
          </Card>
        )}
      </Body>
    </>
  )
}
