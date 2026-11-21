import Card, { CardButton } from '../../components/ui/Card'
import DeskSwitcher from '../../components/ui/DeskSwitcher'
import ListRow from '../../components/ui/ListRow'
import { ChevronRight, Megaphone, Smartphone, Sparkles, UserRound } from 'lucide-react'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import StaffHeaderActions from '../../components/ui/StaffHeaderActions'
import { deskInfo } from '../../lib/desks'
import { attendingCopy } from '../../lib/attendingPhase'
import { signOutEverywhere } from '../MoreScreen'
import { useDesk, useRoles } from '../../lib/roles'
import { useAppStore } from '../../store/appStore'
import { useBrandStore } from '../../store/brandStore'
import { useSessionStore } from '../../store/sessionStore'

function Row({ icon: Icon, title, subtitle, onClick }) {
  return (
    <ListRow onClick={onClick}>
      {Icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mint-soft text-ink">
          <Icon size={18} aria-hidden="true" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t">{title}</span>
        {subtitle && <span className="s">{subtitle}</span>}
      </span>
      <ChevronRight size={16} className="text-muted" aria-hidden="true" />
    </ListRow>
  )
}

/** Staff settings: switch desk (admins see every wireframe role), profile, sign out. */
export default function StaffMoreScreen() {
  const roles = useRoles()
  const desk = useDesk()
  const user = useSessionStore((state) => state.user)
  const setDeskKey = useSessionStore((state) => state.setDeskKey)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const switchTab = useAppStore((state) => state.switchTab)
  const startDate = useBrandStore((state) => state.startDate)
  const endDate = useBrandStore((state) => state.endDate)
  const attending = attendingCopy(startDate, endDate)

  function changeDesk(key) {
    setDeskKey(key)
    switchTab('shome')
  }

  return (
    <>
      <ScreenHeader kicker="More" title="Staff settings" tone="teal" right={<StaffHeaderActions find={false} />} />
      <Body>
        <Card className="card">
          {roles.canSwitchDesks ? (
            <>
              <DeskSwitcher
                id="staff-desk"
                label="My desk"
                labelTone="muted"
                desks={roles.desks}
                value={desk?.key ?? ''}
                onChange={changeDesk}
              />
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
          <Row icon={Megaphone} title="Announcements" subtitle="Transport, programme, registration" onClick={() => navigateTo('announcements')} />
          <Row icon={Sparkles} title={attending.title} subtitle={attending.actionSubtitle} onClick={() => navigateTo('attending')} />
          <Row icon={UserRound} title="My profile" subtitle={user?.email} onClick={() => navigateTo('profile')} />
        </Card>
        {roles.isParticipant && (
          <CardButton className="gate row text-left" onClick={() => { useAppStore.getState().setMode('delegate'); switchTab('home') }}>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15">
              <Smartphone size={20} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="t">Open the delegate app</span>
              <span className="s">Badge, programme, transport, connect</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </CardButton>
        )}
        <button type="button" className="btn o" onClick={signOutEverywhere}>Sign out</button>
      </Body>
    </>
  )
}
