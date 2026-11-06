import Card, { CardButton } from '../components/ui/Card'
import { ChevronRight } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import ListRow from '../components/ui/ListRow'
import PushCard from '../components/PushCard'
import ScreenHeader, { Body } from '../components/ui/ScreenHeader'
import { api } from '../lib/api'
import { disablePush } from '../lib/push'
import { useInstallPrompt } from '../lib/useInstallPrompt'
import { useRegistration } from '../lib/useParticipant'
import { useRoles } from '../lib/roles'
import { useAppStore } from '../store/appStore'
import { useBrandStore } from '../store/brandStore'
import { useSessionStore } from '../store/sessionStore'

// The wireframe's section grid, plus Finance and Messages.
const SECTIONS = [
  ['journey', 'My journey'], ['badge', 'Badge'], ['travel', 'Ticket'],
  ['visa', 'Visa'], ['accommodation', 'Hotel'], ['transport', 'Transport'],
  ['schedule', 'My schedule'], ['venues', 'Venue'], ['partners', 'Partners'],
  ['announcements', 'Announcements'], ['documents', 'Documents'], ['card', 'My card'],
  ['finance', 'Finance'], ['messages', 'Messages'], ['speakers', 'Speakers'],
]

const STYLE_OPTIONS = [['auto', 'Automatic'], ['material', 'Material'], ['ios', 'iOS']]

export async function signOutEverywhere() {
  await disablePush().catch(() => {})
  await api('/auth/logout', { method: 'POST' }).catch(() => {})
  useSessionStore.getState().signOut()
  useAppStore.getState().switchTab('home')
}

function SettingRow({ title, subtitle, onClick }) {
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

export default function MoreScreen() {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const switchTab = useAppStore((state) => state.switchTab)
  const setTourOpen = useAppStore((state) => state.setTourOpen)
  const styleMode = useBrandStore((state) => state.styleMode)
  const setStyleMode = useBrandStore((state) => state.setStyleMode)
  const user = useSessionStore((state) => state.user)
  const roles = useRoles()
  const { registration } = useRegistration()
  const { canInstall, install } = useInstallPrompt()
  const category = [registration?.category_name, registration?.journey?.title].filter(Boolean).join(' · ')

  return (
    <>
      <ScreenHeader kicker="More" title="Profile and settings" />
      <Body>
        <Card className="card row">
          <Avatar name={user?.name} photoUrl={user?.photo_url} size="lg" className="!size-[54px] !text-base" />
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="t">{user?.name}</span>
            {user?.organization && <span className="s">{user.organization}</span>}
            {category && <span className="s font-bold text-maroon">{category}</span>}
          </span>
          <button type="button" className="btn o sm" onClick={() => navigateTo('profile')}>Edit</button>
        </Card>

        {roles.isStaff && (
          <CardButton className="ink row text-left" onClick={() => { useAppStore.getState().setMode('staff'); switchTab('shome') }}>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="t">Open the staff desk</span>
              <span className="s">{(roles.desks.filter((desk) => desk.own).length ? roles.desks.filter((desk) => desk.own) : roles.desks).map((desk) => desk.label).join(' · ')}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </CardButton>
        )}

        <span className="lab">Sections</span>
        <div className="grid grid-cols-3 gap-2">
          {SECTIONS.map(([screen, label]) => (
            <button key={screen} type="button" className="tile" onClick={() => navigateTo(screen)}>{label}</button>
          ))}
        </div>

        <span className="lab">Appearance</span>
        <Card className="card flex flex-col gap-2">
          <span className="s">Automatic uses iOS styling on iPhone and iPad and Material design elsewhere.</span>
          <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-2">
            {STYLE_OPTIONS.map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={styleMode === value} onClick={() => setStyleMode(value)} className={`btn sm ${styleMode === value ? '' : 'o'}`}>
                {label}
              </button>
            ))}
          </div>
        </Card>

        <span className="lab">Settings</span>
        <Card className="card gap-0">
          <SettingRow title="Directory visibility" subtitle={registration?.networking_visible === false ? 'Off · other delegates cannot find you' : 'On · name, organisation, job title, interests'} onClick={() => navigateTo('profile')} />
          <SettingRow title="Interests" subtitle={user?.interests?.length ? user.interests.join(' · ') : 'Not set'} onClick={() => navigateTo('profile')} />
          <SettingRow title="Take the quick tour" subtitle="See what each section does" onClick={() => setTourOpen(true)} />
          {canInstall && <SettingRow title="Install the app" subtitle="Add CPHIA 2026 to your home screen" onClick={install} />}
          <SettingRow title="Get help" subtitle="Message the Travel & Finance desks" onClick={() => navigateTo('messages', { tab: 'desks' })} />
        </Card>

        <PushCard />

        {user?.email && <p className="foot">Signed in as {user.email}</p>}
        <button type="button" className="btn o" onClick={signOutEverywhere}>Sign out</button>
      </Body>
    </>
  )
}
