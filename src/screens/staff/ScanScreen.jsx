import { useEffect, useState } from 'react'
import { Keyboard, ScanLine } from 'lucide-react'
import ScanPersonCard from '../../components/ScanPersonCard'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { scanHelp } from '../../lib/desks'
import { useDesk, useRoles } from '../../lib/roles'
import { api } from '../../lib/api'
import {
  enqueueStaffAction,
  flushStaffQueue,
  isProbablyOfflineError,
  lookupScan,
  rememberScan,
} from '../../lib/staffOffline'
import { useBarcodeScanner } from '../../lib/useBarcodeScanner'
import { useEventSlug } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

/** Scan a badge QR (or type an ID), see who it is and check them in. Works offline from cached scans. */
export default function ScanScreen() {
  const slug = useEventSlug()
  const desk = useDesk()
  const { canScan } = useRoles()
  const base = `/events/${encodeURIComponent(slug)}`
  const showToast = useAppStore((state) => state.showToast)
  const [code, setCode] = useState('')
  const [person, setPerson] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [lastPayload, setLastPayload] = useState('')

  useEffect(() => {
    const flush = () => {
      flushStaffQueue((path, options) => api(path, options)).then(({ flushed }) => {
        if (flushed > 0) showToast(`${flushed} offline action${flushed === 1 ? '' : 's'} synced`, 'success')
      }).catch(() => {})
    }
    flush()
    window.addEventListener('online', flush)
    const onMessage = (event) => {
      if (event.data?.type === 'sync-staff-actions') flush()
    }
    navigator.serviceWorker?.addEventListener?.('message', onMessage)
    return () => {
      window.removeEventListener('online', flush)
      navigator.serviceWorker?.removeEventListener?.('message', onMessage)
    }
  }, [showToast])

  async function resolve(payload) {
    const value = String(payload ?? '').trim()
    if (!value) return
    setBusy(true)
    setError(null)
    setPerson(null)
    setLastPayload(value)
    try {
      const { data } = await api(`${base}/scan/resolve`, { method: 'POST', body: { scan_payload: value } })
      setPerson(data)
      await rememberScan(slug, value, data, 'badge')
    } catch (err) {
      const cached = await lookupScan(slug, value)
      if (cached && isProbablyOfflineError(err)) {
        setPerson(cached)
        showToast('Showing cached badge (offline)', 'info')
      } else {
        setError(
          err.status === 404
            ? 'No registration matches this badge.'
            : err.status === 403
              ? 'You are not allowed to scan for this event.'
              : err.message,
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const scanner = useBarcodeScanner((value) => {
    scanner.stop()
    resolve(value)
  })

  async function checkIn() {
    if (!person?.id) return
    setBusy(true)
    setError(null)
    try {
      const result = await api(`${base}/check-in/event`, { method: 'POST', body: { registration_id: person.id } })
      const next = result.data ?? { ...person, checked_in_at: new Date().toISOString() }
      setPerson(next)
      if (lastPayload) await rememberScan(slug, lastPayload, next, 'badge')
      showToast(
        result.status === 'already_checked_in' ? 'Already checked in' : `${person.name} checked in`,
        result.status === 'already_checked_in' ? 'info' : 'success',
      )
    } catch (err) {
      if (isProbablyOfflineError(err)) {
        await enqueueStaffAction({
          path: `${base}/check-in/event`,
          method: 'POST',
          body: { registration_id: person.id },
        })
        const next = { ...person, checked_in_at: new Date().toISOString(), offline_cached: true }
        setPerson(next)
        if (lastPayload) await rememberScan(slug, lastPayload, next, 'badge')
        showToast('Check-in saved offline — will sync when online', 'info')
      } else {
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ScreenHeader kicker="Scan" title="Scan a badge or QR" tone="teal" />
      <Body>
        {!canScan ? (
          <Card tone="yellow">
            <span className="t">Scanning is not on for your account</span>
            <span className="s">Ask an admin to add the attendance scan permission to your role under Admin users.</span>
          </Card>
        ) : (
          <>
            <Card tone="ink" className="items-center gap-3 py-6">
              <video ref={scanner.videoRef} className={`mb-3 aspect-square w-full rounded-xl bg-ink object-cover ${scanner.isScanning ? '' : 'hidden'}`} muted playsInline />
              {!scanner.isScanning && <div className="grid size-[180px] place-items-center rounded-2xl border-[3px] border-dashed border-sun font-extrabold text-sun">Camera view</div>}
              <span className="s">Point at the participant’s badge or app QR</span>
              {scanner.isSupported ? (
                <Button className="w-full" icon={ScanLine} variant="accent" onClick={scanner.isScanning ? scanner.stop : scanner.start}>
                  {scanner.isScanning ? 'Stop camera' : 'Start scanning'}
                </Button>
              ) : (
                <p className="s">This browser cannot scan with the camera. Type the delegate ID or badge code below.</p>
              )}
              {scanner.error && <p className="text-sm font-bold text-sun">{scanner.error}</p>}
            </Card>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (code.trim()) resolve(code.trim())
              }}
              className="flex gap-2"
            >
              <label htmlFor="badge-code" className="sr-only">Badge code</label>
              <input id="badge-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Delegate ID or badge code" className="min-w-0 flex-1 font-mono" />
              <Button type="submit" icon={Keyboard} size="sm" className="h-auto" disabled={busy}>Look up</Button>
            </form>

            {error && <p role="alert" className="rounded-xl bg-maroon p-3 text-sm font-bold text-cream">{error}</p>}

            {person && (
              <ScanPersonCard person={person} busy={busy} onCheckIn={checkIn} />
            )}
          </>
        )}
        <Card>
          <span className="t">What a scan does for your role</span>
          <span className="s">{scanHelp(desk?.key)}</span>
          <span className="s">Scans you complete online are kept on this device so badge look-ups still work when the network drops.</span>
        </Card>
      </Body>
    </>
  )
}
