import { Suspense, lazy as reactLazy, useEffect, useRef } from 'react'
import { useAppStore } from './store/appStore'
import { useSessionHydrated, useSessionStore } from './store/sessionStore'
import { api, DEFAULT_EVENT_SLUG } from './lib/api'
import { homeScreenFor, useRoles } from './lib/roles'
import SignInScreen from './screens/SignInScreen'
import GuestHomeScreen from './screens/GuestHomeScreen'
// Tab roots stay eager so header + footer chrome do not flash on reload / tab switches.
import HomeScreen from './screens/participant/HomeScreen'
import ProgrammeScreen from './screens/participant/ProgrammeScreen'
import TransportScreen from './screens/participant/TransportScreen'
import ConnectScreen from './screens/connect/ConnectScreen'
import MoreScreen from './screens/MoreScreen'
import AnnouncementsScreen from './screens/AnnouncementsScreen'
import VenuesScreen from './screens/participant/VenuesScreen'
import StaffDesk from './screens/staff/StaffDesk'
import ScanScreen from './screens/staff/ScanScreen'
import FindPersonScreen from './screens/staff/FindPersonScreen'
import DeskTabScreen from './screens/staff/DeskTabScreen'
import StaffMoreScreen from './screens/staff/StaffMoreScreen'
import ChooserScreen from './screens/ChooserScreen'
import BottomNav, { STAFF_SCREENS } from './components/ui/BottomNav'
import PullToRefresh from './components/PullToRefresh'
import Toast from './components/ui/Toast'
import ErrorBoundary from './components/ui/ErrorBoundary'
import ErrorNotice from './components/ui/ErrorNotice'
import OfflineBanner from './components/ui/OfflineBanner'
import QuickTour from './components/QuickTour'
import DocumentViewer from './components/DocumentViewer'
import PhotoRefreshDialog from './components/PhotoRefreshDialog'
import { applyTheme, resolvedStyle, useBrandStore } from './store/brandStore'

const RELOAD_FLAG = 'cphia-pwa-chunk-reload'

// After a deploy, an open app may ask for screen files from the previous build. Reload once
// to pick up the new build instead of showing a blank screen.
function lazy(load) {
  return reactLazy(() =>
    load().then(
      (module) => {
        sessionStorage.removeItem(RELOAD_FLAG)
        return module
      },
      (error) => {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1')
          window.location.reload()
          return new Promise(() => {})
        }
        throw error
      },
    ),
  )
}

// Detail / secondary screens stay lazy; tab roots are eager above.
const SCREENS = {
  // Participant app
  home: HomeScreen,
  journey: lazy(() => import('./screens/participant/JourneyScreen')),
  badge: lazy(() => import('./screens/participant/BadgeScreen')),
  travel: lazy(() => import('./screens/participant/TravelScreen')),
  visa: lazy(() => import('./screens/participant/VisaScreen')),
  accommodation: lazy(() => import('./screens/participant/AccommodationScreen')),
  transport: TransportScreen,
  wall: lazy(() => import('./screens/participant/WallScreen')),
  programme: ProgrammeScreen,
  schedule: lazy(() => import('./screens/participant/ScheduleScreen')),
  session: lazy(() => import('./screens/participant/SessionScreen')),
  speakers: lazy(() => import('./screens/participant/SpeakersScreen')),
  speaker: lazy(() => import('./screens/participant/SpeakerScreen')),
  directions: lazy(() => import('./screens/DirectionsScreen')),
  hall: lazy(() => import('./screens/participant/HallScreen')),
  venues: VenuesScreen,
  partners: lazy(() => import('./screens/participant/PartnersScreen')),
  documents: lazy(() => import('./screens/participant/DocumentsScreen')),
  finance: lazy(() => import('./screens/participant/FinanceScreen')),
  search: lazy(() => import('./screens/SearchScreen')),
  actions: lazy(() => import('./screens/ActionCenterScreen')),
  attending: lazy(() => import('./screens/AttendingGraphicScreen')),
  choose: ChooserScreen,
  connect: ConnectScreen,
  attendee: lazy(() => import('./screens/connect/AttendeeScreen')),
  card: lazy(() => import('./screens/connect/BadgeExchangeScreen')),
  chat: lazy(() => import('./screens/connect/ChatScreen')),
  lounge: lazy(() => import('./screens/connect/LoungeFeedScreen')),
  messages: lazy(() => import('./screens/participant/MessagesScreen')),
  // Shared
  announcements: AnnouncementsScreen,
  profile: lazy(() => import('./screens/ProfileScreen')),
  more: MoreScreen,
  // Staff app (one desk per admin role)
  shome: StaffDesk,
  sscan: ScanScreen,
  sfind: FindPersonScreen,
  sdesk: DeskTabScreen,
  smore: StaffMoreScreen,
}

// Browsing and sign-in work without an account. Any other screen asks for sign-in first.
const PUBLIC_SCREENS = ['home', 'programme', 'session', 'speakers', 'speaker', 'venues', 'hall', 'directions', 'partners', 'announcements', 'search', 'signin']

// Screens only delegates have (they need a registration).
const PARTICIPANT_ONLY = ['actions', 'home', 'journey', 'badge', 'travel', 'visa', 'accommodation', 'transport', 'schedule', 'documents', 'finance', 'connect', 'attendee', 'card', 'chat', 'lounge', 'messages', 'wall']

/** Keeps header chrome visible while session / lazy chunks load so the tab bar does not jump. */
function BootFallback({ kicker = 'CPHIA', title = 'Loading…' }) {
  return (
    <div className="flex min-h-full flex-col" role="status" aria-live="polite">
      <header className="hdr sticky top-0 z-20">
        <p className="kick">{kicker}</p>
        <h1>{title}</h1>
      </header>
      <div className="empty">Loading content…</div>
    </div>
  )
}

/** Shared chrome: scroll area + tab bar as siblings so the menu stays pinned to the phone bottom. */
function AppShell({ children, tour = false }) {
  const scrollRef = useRef(null)
  return (
    <div className="app-shell">
      <div className="app-root" ref={scrollRef}>
        <PullToRefresh scrollRef={scrollRef} />
        <OfflineBanner />
        <ErrorNotice />
        {children}
        <PhotoRefreshDialog />
        <Toast />
        <DocumentViewer />
        {tour}
      </div>
      <BottomNav />
    </div>
  )
}

/** Refreshes the signed-in user (photo, roles, desks) once per app start. */
function useSessionRefresh(isSignedIn) {
  const setSession = useSessionStore((state) => state.setSession)
  useEffect(() => {
    if (!isSignedIn) return
    // Soft refresh: keep the saved session if /auth/me fails during a deploy blip.
    // api() only signs out when the JSON body clearly says the token is dead.
    api('/auth/me').then(({ data }) => setSession(data)).catch(() => {})
  }, [isSignedIn, setSession])
}

/** Keeps the event's colours and logo: applies the last known theme at once, then refreshes it from the API. */
function useBrandSync() {
  const theme = useBrandStore((state) => state.theme)
  const setBrand = useBrandStore((state) => state.setBrand)
  const slug = useSessionStore((state) => state.eventSlug) ?? DEFAULT_EVENT_SLUG

  const styleMode = useBrandStore((state) => state.styleMode)

  useEffect(() => { applyTheme(theme) }, [theme])
  useEffect(() => { document.documentElement.dataset.style = resolvedStyle(styleMode) }, [styleMode])
  useEffect(() => {
    api(`/events/${encodeURIComponent(slug)}`)
      .then(({ data }) => setBrand({
        theme: data?.theme,
        logoUrl: data?.logo_url,
        maps: data?.maps,
        startDate: data?.start_date ?? null,
        endDate: data?.end_date ?? null,
        signInDefault: data?.participant_sign_in_default,
      }))
      .catch(() => {})
  }, [slug, setBrand])
}

export default function App() {
  useBrandSync()
  const sessionReady = useSessionHydrated()
  const screen = useAppStore((state) => state.screen)
  const params = useAppStore((state) => state.params)
  const storeToken = useSessionStore((state) => state.token)
  const roles = useRoles()
  const mode = useAppStore((state) => state.mode)
  const capabilities = useSessionStore((state) => state.capabilities)
  const staffDesks = useSessionStore((state) => state.staffDesks)
  useSessionRefresh(sessionReady && Boolean(storeToken))

  // Wait for localStorage before choosing guest vs signed-in — otherwise an app update
  // briefly looks signed-out and can race a guest render over the saved session.
  // BootFallback keeps the header band so the tab bar does not jump on reload.
  if (!sessionReady) {
    return (
      <AppShell>
        <BootFallback />
      </AppShell>
    )
  }

  if (!storeToken) {
    // Guests browse the public screens; anything personal shows sign-in and returns to that screen after it.
    const GuestScreen = screen === 'home' ? GuestHomeScreen : screen === 'signin' ? SignInScreen : PUBLIC_SCREENS.includes(screen) ? SCREENS[screen] : SignInScreen
    return (
      <AppShell>
        <ErrorBoundary>
          <Suspense fallback={<BootFallback kicker="CPHIA" title="Loading…" />}>
            <div className="screen-enter flex min-h-full flex-col" key={screen}>
              <GuestScreen params={params} />
            </div>
          </Suspense>
        </ErrorBoundary>
      </AppShell>
    )
  }

  const home = homeScreenFor(capabilities, staffDesks, mode)
  const allowed =
    SCREENS[screen] &&
    (screen !== 'choose' || (roles.isParticipant && roles.isStaff)) &&
    (!STAFF_SCREENS.includes(screen) || roles.isStaff) &&
    (!PARTICIPANT_ONLY.includes(screen) || roles.isParticipant)
  const Screen = allowed ? SCREENS[screen] : SCREENS[home]

  return (
    <AppShell tour={roles.isParticipant && screen !== 'choose' ? <QuickTour /> : null}>
      {/* Stable boundary: do not remount on params so headers stay while detail content swaps. */}
      <ErrorBoundary>
        <Suspense fallback={<BootFallback kicker="CPHIA" title="Loading…" />}>
          <div className="screen-enter flex min-h-full flex-col" key={screen}>
            <Screen params={params} />
          </div>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  )
}
