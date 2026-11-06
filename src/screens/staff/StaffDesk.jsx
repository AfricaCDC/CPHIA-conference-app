import Card from '../../components/ui/Card'
import { ExternalLink, ScanLine, UserSearch } from 'lucide-react'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import BadgeDeskScreen from './BadgeDeskScreen'
import HotelDeskScreen from './HotelDeskScreen'
import { deskInfo } from '../../lib/desks'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useDesk, useRoles } from '../../lib/roles'
import { useAppStore } from '../../store/appStore'
import { useSessionStore } from '../../store/sessionStore'

/** "My desk": the staff home for the active admin role, as in the wireframe. */
export default function StaffDesk() {
  const slug = useEventSlug()
  const desk = useDesk()
  const roles = useRoles()
  const user = useSessionStore((state) => state.user)
  const setDeskKey = useSessionStore((state) => state.setDeskKey)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const switchTab = useAppStore((state) => state.switchTab)
  const stats = useRemote(roles.canScan ? `/events/${encodeURIComponent(slug)}/check-in/event/stats` : null)
  const s = stats.data?.data

  if (!desk) return null
  // The badge desk has its own print queue and badge check, as on the web print desk.
  if (desk.key === 'badge') {
    return (
      <>
        {roles.canSwitchDesks && (
          <div className="bg-ink px-[18px] pb-3 pt-[calc(env(safe-area-inset-top)+10px)]">
            <label className="lab text-cream/70" htmlFor="desk-switch-badge">Desk</label>
            <select
              id="desk-switch-badge"
              className="mt-1 w-full rounded-[10px] border-0 bg-white/14 px-3 py-2.5 text-sm font-bold text-cream"
              value={desk.key}
              onChange={(event) => setDeskKey(event.target.value)}
            >
              {roles.desks.map((entry) => (
                <option key={entry.key} value={entry.key} className="text-ink">
                  {deskInfo(entry.key).kicker || entry.label}{entry.own ? ' · your role' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <BadgeDeskScreen />
      </>
    )
  }

  if (desk.key === 'hotel_usher') {
    return (
      <>
        <ScreenHeader kicker={desk.kicker} title={desk.title} tone="teal">
          {roles.canSwitchDesks && (
            <select
              aria-label="Switch staff desk"
              className="mt-1 w-full rounded-[10px] border-0 bg-white/14 px-3 py-2.5 text-sm font-bold text-cream"
              value={desk.key}
              onChange={(event) => setDeskKey(event.target.value)}
            >
              {roles.desks.map((entry) => (
                <option key={entry.key} value={entry.key} className="text-ink">
                  {deskInfo(entry.key).kicker || entry.label}{entry.own ? ' · your role' : ''}
                </option>
              ))}
            </select>
          )}
        </ScreenHeader>
        <Body>
          <HotelDeskScreen />
        </Body>
      </>
    )
  }

  return (
    <>
      <ScreenHeader kicker={desk.kicker} title={desk.title} tone="teal">
        {roles.canSwitchDesks && (
          <select
            aria-label="Switch staff desk"
            className="mt-1 w-full rounded-[10px] border-0 bg-white/14 px-3 py-2.5 text-sm font-bold text-cream"
            value={desk.key}
            onChange={(event) => setDeskKey(event.target.value)}
          >
            {roles.desks.map((entry) => (
              <option key={entry.key} value={entry.key} className="text-ink">
                {deskInfo(entry.key).kicker || entry.label}{entry.own ? ' · your role' : ''}
              </option>
            ))}
          </select>
        )}
      </ScreenHeader>
      <Body>
        {roles.canScan && (
          <div className="kpi" aria-label="Check-in today">
            <div><b>{s?.total_confirmed?.toLocaleString() ?? '–'}</b><span>registered</span></div>
            <div><b>{s?.total_checked_in?.toLocaleString() ?? '–'}</b><span>checked in</span></div>
            <div><b>{s ? `${s.checkin_rate}%` : '–'}</b><span>check-in rate</span></div>
          </div>
        )}

        {desk.scan && roles.canScan && (
          <button type="button" className="btn y" onClick={() => switchTab('sscan')}><ScanLine size={18} aria-hidden="true" />Scan participant QR</button>
        )}

        <Card className="card">
          <span className="lab">{desk.label}</span>
          <span className="t">What you do here</span>
          <span className="s">{desk.about}</span>
        </Card>

        <div className="grid grid-cols-2 gap-2.5">
          {desk.find && <button type="button" className="btn" onClick={() => switchTab('sfind')}><UserSearch size={18} aria-hidden="true" />Find a participant</button>}
          {desk.web_url && (
            <a className={`btn o ${desk.find ? '' : 'col-span-2'}`} href={desk.web_url} target="_blank" rel="noopener noreferrer">
              Open my desk queue <ExternalLink size={15} aria-hidden="true" />
            </a>
          )}
        </div>

        <Card className="card mint">
          <span className="t">The full queue is in the Event Management Center</span>
          <span className="s">The phone shows your desk and the quick actions. Bulk work, approvals and exports stay on the desktop, and everything you do there reaches participants in their app.</span>
        </Card>

        <button type="button" className="btn o" onClick={() => navigateTo('announcements')}>Announcements</button>
        {roles.isParticipant && <button type="button" className="btn o" onClick={() => switchTab('home')}>Back to my delegate app</button>}
        <p className="foot">Signed in as {user?.name}</p>
      </Body>
    </>
  )
}
