import { useEffect, useState } from 'react'
import { KeyRound, LogIn, Mail } from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Body } from '../components/ui/ScreenHeader'
import BrandLogo from '../components/BrandLogo'
import { CONFERENCE, REGISTRATION_URL } from '../data/participant'
import { api, ApiError, DEFAULT_EVENT_SLUG, firstFieldError } from '../lib/api'
import { useBrandStore } from '../store/brandStore'
import { useSessionStore } from '../store/sessionStore'

const INPUT_CLASS = 'surface border-hairline min-h-11 w-full rounded-xl border px-3'

/** Shown until the server says how long a set-password link works. */
const DEFAULT_LINK_VALID_FOR = '24 hours'

/** "9 min 05 s" / "42 s" for the wait before another link can be requested. */
function formatWait(seconds) {
  const total = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return minutes === 0 ? `${rest} s` : `${minutes} min ${String(rest).padStart(2, '0')} s`
}

/**
 * Emails a link to set (or reset) a password. The server holds each email address to a
 * 10 minute wait after the first link, 20 minutes after the second, and three links in
 * any hour; the wait is shown on the button.
 */
function SetPasswordLink({ email, heading, lead }) {
  const cleanEmail = email.trim()
  const [busy, setBusy] = useState(false)
  /** Lower-cased email the notice, error and wait below belong to. */
  const [answeredFor, setAnsweredFor] = useState(null)
  const [sent, setSent] = useState(false)
  const [alreadyRequested, setAlreadyRequested] = useState(false)
  const [error, setError] = useState(null)
  const [validFor, setValidFor] = useState(DEFAULT_LINK_VALID_FOR)
  const [availableAt, setAvailableAt] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (availableAt === null) {
      setSecondsLeft(0)
      return undefined
    }
    // Count from the clock, not from ticks, so a phone that slept still shows the right time.
    const tick = () => {
      const left = Math.max(0, Math.ceil((availableAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) setAvailableAt(null)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [availableAt])

  const aboutThisEmail = answeredFor !== null && answeredFor === cleanEmail.toLowerCase()
  const showSent = aboutThisEmail && sent
  const showAlreadyRequested = aboutThisEmail && !sent && alreadyRequested
  const waiting = aboutThisEmail && secondsLeft > 0
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)

  function startWait(seconds) {
    const wait = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
    setAvailableAt(wait > 0 ? Date.now() + wait * 1000 : null)
  }

  async function requestLink() {
    const sameEmailAsBefore = aboutThisEmail
    setBusy(true)
    setError(null)
    try {
      const data = await api('/auth/participant/forgot-password', {
        method: 'POST',
        body: { email: cleanEmail, event_slug: DEFAULT_EVENT_SLUG },
      })
      setAnsweredFor(cleanEmail.toLowerCase())
      setSent(true)
      setAlreadyRequested(false)
      if (typeof data?.link_valid_for === 'string' && data.link_valid_for.trim()) setValidFor(data.link_valid_for.trim())
      startWait(data?.retry_after_seconds)
    } catch (err) {
      setAnsweredFor(cleanEmail.toLowerCase())
      if (err instanceof ApiError && err.body?.reset_throttled === true) {
        // Still waiting: keep the "sent" notice only when it was about this same address.
        setSent(sent && sameEmailAsBefore)
        setAlreadyRequested(true)
        startWait(err.body.retry_after_seconds)
      } else {
        setSent(false)
        setAlreadyRequested(false)
        setAvailableAt(null)
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="surface border-hairline mt-3 space-y-3 rounded-xl border p-3 text-sm">
      {heading && <p className="font-semibold">{heading}</p>}
      {showSent ? (
        <p role="status">
          If an account exists for <span className="font-semibold">{cleanEmail}</span>, we sent a link to set your password.
          Check your inbox and spam folder. The link works for {validFor}, and only the newest link works.
          It opens the conference website; set your password there, then come back here and sign in.
        </p>
      ) : showAlreadyRequested ? (
        <p role="status">
          A link was requested for <span className="font-semibold">{cleanEmail}</span> a short while ago. Check your inbox and
          spam folder before asking for another.
        </p>
      ) : (
        lead && <p>{lead}</p>
      )}
      {aboutThisEmail && error && (
        <p role="alert" className="font-semibold text-maroon dark:text-[#E0587A]">{error}</p>
      )}
      <Button variant="secondary" icon={waiting ? undefined : Mail} className="w-full" disabled={!emailLooksValid || busy || waiting} onClick={requestLink}>
        {busy
          ? 'Sending…'
          : waiting
            ? `Send another link in ${formatWait(secondsLeft)}`
            : showSent || showAlreadyRequested
              ? 'Send another link'
              : 'Email me a link to set my password'}
      </Button>
      {!emailLooksValid && <p className="text-[13px] text-muted">Enter your email address above first.</p>}
    </div>
  )
}

/**
 * One sign-in for delegates and staff. The event decides which option shows first:
 * a password (with a button that emails a set-password link to anyone who has none yet),
 * or a 6-digit code by email. The other option stays one tap away.
 */
export default function SignInScreen() {
  const signIn = useSessionStore((state) => state.signIn)
  const eventDefault = useBrandStore((state) => state.signInDefault)
  /** Null follows the event setting; a value is the person's own choice on this screen. */
  const [chosenMethod, setChosenMethod] = useState(null)
  const method = chosenMethod ?? (eventDefault === 'email_code' ? 'code' : 'password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [registrationUrl, setRegistrationUrl] = useState(null)
  /** Why the set-password button is showing: "not_set", "failed" (after a sign-in attempt) or "asked". */
  const [passwordHelp, setPasswordHelp] = useState(null)

  function switchMethod(next) {
    setChosenMethod(next)
    setError(null)
    setRegistrationUrl(null)
    setPasswordHelp(null)
    setPassword('')
    setCode('')
    setCodeSent(false)
  }

  async function signInWithPassword(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setPasswordHelp(null)
    try {
      const session = await api('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password, client: 'pwa' },
      })
      signIn(session, DEFAULT_EVENT_SLUG)
    } catch (err) {
      if (err instanceof ApiError && err.body?.password_not_set === true) {
        // Most delegates have only ever used a code, so there is no password to get wrong.
        setPasswordHelp('not_set')
        return
      }
      setError(firstFieldError(err, 'email') ?? firstFieldError(err, 'password') ?? err.message)
      // The account may hold a password nobody was ever told, so a wrong one gets the same offer.
      if (err instanceof ApiError && err.status === 422) setPasswordHelp('failed')
    } finally {
      setBusy(false)
    }
  }

  async function sendCode(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setRegistrationUrl(null)
    try {
      await api('/auth/otp/send', { method: 'POST', body: { email, event_slug: DEFAULT_EVENT_SLUG } })
      setCodeSent(true)
    } catch (err) {
      setError(firstFieldError(err, 'email') ?? err.message)
      if (err instanceof ApiError) setRegistrationUrl(err.body?.registration_url ?? null)
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const session = await api('/auth/otp/verify', {
        method: 'POST',
        body: { email, code, event_slug: DEFAULT_EVENT_SLUG, client: 'pwa' },
      })
      signIn(session, DEFAULT_EVENT_SLUG)
    } catch (err) {
      setError(firstFieldError(err, 'code') ?? firstFieldError(err, 'email') ?? err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="hdr gap-2 pb-5 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="flex h-16 items-center">
          <BrandLogo className="h-16 max-w-[220px]" />
        </div>
        <p className="kick">{CONFERENCE.dates}</p>
        <h1>{`Sign in to ${CONFERENCE.name}`}</h1>
      </header>
      <Body>
      <p className="s">
        One sign-in for delegates and staff. Use the email address you registered with, or your staff account email.{' '}
        {method === 'password'
          ? 'Enter your password. If you have not set one yet, we can email you a link to set it.'
          : 'We will send you a 6-digit code.'}
      </p>

      <Card>
        {method === 'password' ? (
          <form onSubmit={signInWithPassword} className="space-y-3">
            <label htmlFor="email" className="text-sm font-semibold">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (passwordHelp !== 'asked') setPasswordHelp(null) }}
              className={INPUT_CLASS}
            />
            <label htmlFor="password" className="text-sm font-semibold">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLASS}
            />
            <Button type="submit" icon={LogIn} className="w-full" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</Button>
            {!passwordHelp && (
              <Button variant="ghost" className="w-full" onClick={() => { setError(null); setPasswordHelp('asked') }}>No password yet, or forgot it?</Button>
            )}
            <Button variant="ghost" className="w-full" onClick={() => switchMethod('code')}>Email me a code instead</Button>
          </form>
        ) : !codeSent ? (
          <form onSubmit={sendCode} className="space-y-3">
            <label htmlFor="email" className="text-sm font-semibold">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
            <Button type="submit" icon={Mail} className="w-full" disabled={busy || !email}>{busy ? 'Sending…' : 'Email me a code'}</Button>
            <Button variant="ghost" className="w-full" onClick={() => switchMethod('password')}>Sign in with a password instead</Button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <p className="text-sm">We sent a code to <span className="font-semibold">{email}</span>. It expires in 20 minutes.</p>
            <label htmlFor="code" className="text-sm font-semibold">6-digit code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={`${INPUT_CLASS} font-mono text-lg tracking-[0.4em]`}
            />
            <Button type="submit" icon={KeyRound} className="w-full" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Sign in'}</Button>
            <Button variant="ghost" className="w-full" onClick={() => { setCodeSent(false); setCode('') }}>Use another email</Button>
            <Button variant="ghost" className="w-full" onClick={() => switchMethod('password')}>Sign in with a password instead</Button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-maroon dark:text-[#E0587A]">
            {error}{' '}
            {registrationUrl && <a href={registrationUrl} className="underline">Register for the conference</a>}
          </p>
        )}
        {method === 'password' && passwordHelp && (
          <SetPasswordLink
            email={email}
            heading={passwordHelp === 'not_set' ? 'You have not set a password for this account yet.' : 'No password yet, or forgot it?'}
            lead={passwordHelp === 'not_set'
              ? 'We can email you a link. Open it to choose your password, then come back here and sign in.'
              : 'We can email you a link to set a new password. Open it to choose your password, then come back here and sign in.'}
          />
        )}
      </Card>
        <p className="pt-2 text-center text-[13px] text-muted">
          Not registered yet?{' '}
          <a href={REGISTRATION_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-tertiary underline">Register for CPHIA 2026</a>
        </p>
      </Body>
    </>
  )
}
