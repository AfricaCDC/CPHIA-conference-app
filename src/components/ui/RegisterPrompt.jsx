import { useEffect, useState } from 'react'
import Card from './Card'
import Button from './Button'
import { api, firstFieldError } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useSessionStore } from '../../store/sessionStore'
import { useAppStore } from '../../store/appStore'

/** Shown in place of a delegate's own details when the account has no conference registration yet. */
export default function RegisterPrompt({ what, onLinked }) {
  const registrationUrl = useSessionStore((state) => state.registrationUrl)
  const capabilities = useSessionStore((state) => state.capabilities)
  const slug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const isStaff = Boolean(capabilities?.staff || capabilities?.scanner || capabilities?.people_approved)
  const [canLink, setCanLink] = useState(false)
  const [step, setStep] = useState('idle') // idle | code | done
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [masked, setMasked] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isStaff || !slug) return undefined
    let cancelled = false
    api(`/participant/link-registration?event_slug=${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!cancelled) setCanLink(Boolean(data?.can_link))
      })
      .catch(() => {
        if (!cancelled) setCanLink(false)
      })
    return () => { cancelled = true }
  }, [isStaff, slug])

  async function requestCode() {
    setBusy(true)
    setError(null)
    try {
      const data = await api('/participant/link-registration/request', {
        method: 'POST',
        body: { event_slug: slug, email: email.trim() },
      })
      setMasked(data.masked_email ?? email.trim())
      setStep('code')
      showToast(data.message || 'Code sent')
    } catch (err) {
      setError(firstFieldError(err, 'email') || err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode() {
    setBusy(true)
    setError(null)
    try {
      const data = await api('/participant/link-registration/verify', {
        method: 'POST',
        body: { event_slug: slug, email: email.trim(), code: code.trim() },
      })
      setStep('done')
      showToast(data.message || 'Registration linked')
      onLinked?.()
    } catch (err) {
      setError(firstFieldError(err, 'code') || firstFieldError(err, 'email') || err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="card">
      <span className="t">Register to see your {what}</span>
      <span className="s">
        {isStaff
          ? 'Your staff account has no conference registration on this email yet. Register as a delegate, or link the registration you completed with another email.'
          : 'Your account has no conference registration yet. Register as a delegate to get your badge, programme and travel.'}
      </span>
      {registrationUrl && (
        <a href={registrationUrl} className="font-bold text-teal-dark underline">
          Register for the conference
        </a>
      )}

      {canLink && step !== 'done' ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <span className="t text-[15px]">Link an existing registration</span>
          <span className="s">
            Use the email on your participant registration. We send a 6-digit code there to confirm it is yours, then that profile opens on this admin account.
          </span>
          {step === 'idle' ? (
            <>
              <label className="lab" htmlFor="link-email">Registration email</label>
              <input
                id="link-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organisation.org"
              />
              {error && <span className="text-sm font-semibold text-destructive">{error}</span>}
              <Button size="sm" disabled={busy || !email.trim()} onClick={requestCode}>
                {busy ? 'Sending…' : 'Send email code'}
              </Button>
            </>
          ) : (
            <>
              <span className="s" role="status">Code sent to {masked}. Enter it below.</span>
              <label className="lab" htmlFor="link-code">Email code</label>
              <input
                id="link-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
              />
              {error && <span className="text-sm font-semibold text-destructive">{error}</span>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy || code.length < 6} onClick={verifyCode}>
                  {busy ? 'Linking…' : 'Link registration'}
                </Button>
                <button
                  type="button"
                  className="text-sm font-bold text-teal-dark underline"
                  disabled={busy}
                  onClick={() => { setStep('idle'); setCode(''); setError(null) }}
                >
                  Change email
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {step === 'done' ? (
        <span className="mt-2 text-sm font-semibold text-teal-dark">Registration linked. Refresh if your badge or hotel has not appeared yet.</span>
      ) : null}
    </Card>
  )
}
