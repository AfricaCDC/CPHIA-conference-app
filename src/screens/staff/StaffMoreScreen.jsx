import Card from '../../components/ui/Card'
import ListRow from '../../components/ui/ListRow'
import { ChevronRight } from 'lucide-react'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { deskInfo } from '../../lib/desks'
import { signOutEverywhere } from '../MoreScreen'
import { useDesk, useRoles } from '../../lib/roles'
import { useAppStore } from '../../store/appStore'
import { useSessionStore } from '../../store/sessionStore'

function Row({ title, subtitle, onClick }) {
  return (
    <ListRow onClick={onClick}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t">{title}</span>
        {subtitle && <span className="s">{subtitle}</span>}
      </span>
      <ChevronRight size={16} className="text-muted" aria-hidden="true" />
    </ListRow>
  )
}

function deskOptionLabel(entry) {
  const info = deskInfo(entry.key)
  const title = info.kicker || entry.label
  return entry.own ? `${title} · your role` : title
}

/** Staff settings: switch desk (admins see every wireframe role), profile, sign out. */
export default function StaffMoreScreen() {
  const roles = useRoles()
  const desk = useDesk()
  const user = useSessionStore((state) => state.user)
  const setDeskKey = useSessionStore((state) => state.setDeskKey)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const switchTab = useAppStore((state) => state.switchTab)

  function changeDesk(event) {
    const key = event.target.value
    setDeskKey(key)
    switchTab('shome')
  }

  return (
    <>
      <ScreenHeader kicker="More" title="Staff settings" tone="teal" />
      <Body>
        <Card className="card">
          {roles.canSwitchDesks ? (
            <>
              <label className="lab" htmlFor="staff-desk">My desk</label>
              <select
                id="staff-desk"
                className="mt-1 w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm font-bold text-ink"
                value={desk?.key ?? ''}
                onChange={changeDesk}
              >
                {roles.desks.map((entry) => (
                  <option key={entry.key} value={entry.key}>{deskOptionLabel(entry)}</option>
                ))}
              </select>
              <span className="s mt-2">
                {roles.desks.every((entry) => entry.own)
                  ? 'Switch between the staff desks assigned to you under Admin users.'
                  : roles.desks.some((entry) => entry.own)
                    ? 'Your assigned roles are marked. As an administrator you can also open every other staff desk to cover or check it.'
                    : 'As an administrator you can open every staff desk. Assign yourself a desk role under Admin users if you want a default.'}
              </span>
            </>
          ) : (
            <>
              <span className="lab">My role</span>
              <span className="t">{desk ? (deskInfo(desk.key).kicker || desk.label) : 'Staff'}</span>
              <span className="s">Your roles come from Admin users in the Event Management Center. Ask an admin to change them.</span>
            </>
          )}
        </Card>
        <Card className="card gap-0">
          <Row title="Announcements" subtitle="Transport, programme, registration" onClick={() => navigateTo('announcements')} />
          <Row title="My profile" subtitle={user?.email} onClick={() => navigateTo('profile')} />
          {roles.isParticipant && <Row title="Open the delegate app" subtitle="Badge, programme, transport, connect" onClick={() => { useAppStore.getState().setMode('delegate'); switchTab('home') }} />}
        </Card>
        <button type="button" className="btn o" onClick={signOutEverywhere}>Sign out</button>
      </Body>
    </>
  )
}
