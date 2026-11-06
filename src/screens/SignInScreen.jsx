import { useState } from 'react'
import { KeyRound, Mail } from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Body } from '../components/ui/ScreenHeader'
import BrandLogo from '../components/BrandLogo'
import { CONFERENCE, REGISTRATION_URL } from '../data/participant'
import { api, ApiError, DEFAULT_EVENT_SLUG, firstFieldError } from '../lib/api'
import { useSessionStore } from '../store/sessionStore'

const INPUT_CLASS = 'surface border-hairline min-h-11 w-full rounded-xl border px-3'

/** Passwordless sign-in: the delegate gets a 6-digit code by email (same as the mobile app). */
export default function SignInScreen() {
  const signIn = useSessionStore((state) => state.signIn)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [registrationUrl, setRegistrationUrl] = useState(null)

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
      <p className="s">One sign-in for delegates and staff. Use the email address you registered with, or your staff account email. We will send you a 6-digit code.</p>

      <Card>
        {!codeSent ? (
          <form onSubmit={sendCode} className="space-y-3">
            <label htmlFor="email" className="text-sm font-semibold">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
            <Button type="submit" icon={Mail} className="w-full" disabled={busy || !email}>{busy ? 'Sending…' : 'Email me a code'}</Button>
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
          </form>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-maroon dark:text-[#E0587A]">
            {error}{' '}
            {registrationUrl && <a href={registrationUrl} className="underline">Register for the conference</a>}
          </p>
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
