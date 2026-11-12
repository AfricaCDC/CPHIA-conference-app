import { Suspense, lazy as reactLazy, useEffect, useRef } from 'react'
import { useAppStore } from './store/appStore'
import { useSessionStore } from './store/sessionStore'
import { api, DEFAULT_EVENT_SLUG } from './lib/api'
import { homeScreenFor, useRoles } from './lib/roles'
import SignInScreen from './screens/SignInScreen'
import GuestHomeScreen from './screens/GuestHomeScreen'
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

// Each screen is its own chunk and draws its own wireframe header.
const SCREENS = {
  // Participant app
  home: lazy(() => import('./screens/participant/HomeScreen')),
  journey: lazy(() => import('./screens/participant/JourneyScreen')),
  badge: lazy(() => import('./screens/participant/BadgeScreen')),
  travel: lazy(() => import('./screens/participant/TravelScreen')),
  visa: lazy(() => import('./screens/participant/VisaScreen')),
  accommodation: lazy(() => import('./screens/participant/AccommodationScreen')),
  transport: lazy(() => import('./screens/participant/TransportScreen')),
  programme: lazy(() => import('./screens/participant/ProgrammeScreen')),
  schedule: lazy(() => import('./screens/participant/ScheduleScreen')),
  session: lazy(() => import('./screens/participant/SessionScreen')),
  speakers: lazy(() => import('./screens/participant/SpeakersScreen')),
  speaker: lazy(() => import('./screens/participant/SpeakerScreen')),
  directions: lazy(() => import('./screens/DirectionsScreen')),
  hall: lazy(() => import('./screens/participant/HallScreen')),
  venues: lazy(() => import('./screens/participant/VenuesScreen')),
  partners: lazy(() => import('./screens/participant/PartnersScreen')),
  documents: lazy(() => import('./screens/participant/DocumentsScreen')),
  finance: lazy(() => import('./screens/participant/FinanceScreen')),
  search: lazy(() => import('./screens/SearchScreen')),
  actions: lazy(() => import('./screens/ActionCenterScreen')),
  choose: lazy(() => import('./screens/ChooserScreen')),
  connect: lazy(() => import('./screens/connect/ConnectScreen')),
  attendee: lazy(() => import('./screens/connect/AttendeeScreen')),
  card: lazy(() => import('./screens/connect/BadgeExchangeScreen')),
  chat: lazy(() => import('./screens/connect/ChatScreen')),
  lounge: lazy(() => import('./screens/connect/LoungeFeedScreen')),
  messages: lazy(() => import('./screens/participant/MessagesScreen')),
  // Shared
  announcements: lazy(() => import('./screens/AnnouncementsScreen')),
  profile: lazy(() => import('./screens/ProfileScreen')),
  more: lazy(() => import('./screens/MoreScreen')),
  // Staff app (one desk per admin role)
  shome: lazy(() => import('./screens/staff/StaffDesk')),
  sscan: lazy(() => import('./screens/staff/ScanScreen')),
  sfind: lazy(() => import('./screens/staff/FindPersonScreen')),
  sdesk: lazy(() => import('./screens/staff/DeskTabScreen')),
  smore: lazy(() => import('./screens/staff/StaffMoreScreen')),
}

// Browsing and sign-in work without an account. Any other screen asks for sign-in first.
const PUBLIC_SCREENS = ['home', 'programme', 'session', 'speakers', 'speaker', 'venues', 'hall', 'directions', 'partners', 'announcements', 'search', 'signin']

// Screens only delegates have (they need a registration).
const PARTICIPANT_ONLY = ['actions', 'home', 'journey', 'badge', 'travel', 'visa', 'accommodation', 'transport', 'schedule', 'documents', 'finance', 'connect', 'attendee', 'card', 'chat', 'lounge', 'messages']

function ScreenFallback() {
  return <div className="empty" role="status">Loading…</div>
}

/** Shared chrome: scroll container, pull-to-refresh, offline/error banners, tabs, toast. */
function AppShell({ children, tour = false }) {
  const scrollRef = useRef(null)
  return (
    <div className="app-root" ref={scrollRef}>
      <PullToRefresh scrollRef={scrollRef} />
      <OfflineBanner />
      <ErrorNotice />
      {children}
      <BottomNav />
      <PhotoRefreshDialog />
      <Toast />
      <DocumentViewer />
      {tour}
    </div>
  )
}

/** Refreshes the signed-in user (photo, roles, desks) once per app start. */
function useSessionRefresh(isSignedIn) {
  const setSession = useSessionStore((state) => state.setSession)
  useEffect(() => {
    if (!isSignedIn) return
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
      .then(({ data }) => setBrand({ theme: data?.theme, logoUrl: data?.logo_url }))
      .catch(() => {})
  }, [slug, setBrand])
}

export default function App() {
  useBrandSync()
  const screen = useAppStore((state) => state.screen)
  const params = useAppStore((state) => state.params)
  const isSignedIn = useSessionStore((state) => Boolean(state.token))
  const roles = useRoles()
  const mode = useAppStore((state) => state.mode)
  const capabilities = useSessionStore((state) => state.capabilities)
  const staffDesks = useSessionStore((state) => state.staffDesks)
  useSessionRefresh(isSignedIn)

  if (!isSignedIn) {
    // Guests browse the public screens; anything personal shows sign-in and returns to that screen after it.
    const GuestScreen = screen === 'home' ? GuestHomeScreen : screen === 'signin' ? SignInScreen : PUBLIC_SCREENS.includes(screen) ? SCREENS[screen] : SignInScreen
    return (
      <AppShell>
        <ErrorBoundary key={`guest-${screen}-${JSON.stringify(params)}`}>
          <Suspense fallback={<ScreenFallback />}>
            <div className="screen-enter flex flex-1 flex-col pb-24">
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
      <ErrorBoundary key={`${screen}-${JSON.stringify(params)}`}>
        <Suspense fallback={<ScreenFallback />}>
          <div className="screen-enter flex flex-1 flex-col pb-24">
            <Screen params={params} />
          </div>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  )
}
