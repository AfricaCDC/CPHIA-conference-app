import { useEffect, useState } from 'react'
import { Keyboard, ScanLine } from 'lucide-react'
import ScanPersonCard from '../../components/ScanPersonCard'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import StaffHeaderActions from '../../components/ui/StaffHeaderActions'
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
import PermissionCoachBanner from '../../components/PermissionCoachBanner'
import PermissionsPrompt from '../../components/PermissionsPrompt'
import { isStandaloneDisplay, openAppInBrowserForCamera } from '../../lib/camera'
import { useBarcodeScanner } from '../../lib/useBarcodeScanner'
import { useEventSlug } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'
import { usePermissionsPromptStore } from '../../store/permissionsPromptStore'

const PRINT_STATUS = {
  not_printed: ['Not printed', 'sun'],
  reprint_needed: ['Needs web reprint', 'maroon'],
  printed: ['Printed · current', 'teal'],
}

/** Scan a badge QR (or type an ID), see who it is and check them in. Works offline from cached scans. */
export default function ScanScreen() {
  const slug = useEventSlug()
  const desk = useDesk()
  const { canScan, desks } = useRoles()
  const hasBadgeDesk = desks.some((entry) => entry.key === 'badge')
  const base = `/events/${encodeURIComponent(slug)}`
  const badgeBase = `${base}/badge-desk`
  const showToast = useAppStore((state) => state.showToast)
  const requestSetup = usePermissionsPromptStore((state) => state.requestSetup)
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
    setReprintReason('')
    try {
      // Badge desk staff get the richer desk verify (same card fields + issue flags).
      const path = hasBadgeDesk ? `${badgeBase}/verify` : `${base}/scan/resolve`
      const { data } = await api(path, { method: 'POST', body: { scan_payload: value } })
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

  async function issueBadge() {
    if (!person?.id) return
    setBusy(true)
    setError(null)
    try {
      const { data } = await api(`${badgeBase}/registrations/${person.id}/issue`, { method: 'POST', body: {} })
      setPerson(data)
      if (lastPayload) await rememberScan(slug, lastPayload, data, 'badge')
      showToast(`${person.name} issued`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const printStatus = person?.print_status
  const printLabel = printStatus ? PRINT_STATUS[printStatus] : null

  return (
    <>
      <PermissionCoachBanner active={scanner.isRequestingPermission} />
      <ScreenHeader kicker="Scan" title="Scan a badge or QR" tone="teal" right={<StaffHeaderActions find />} />
      <Body>
        {!canScan ? (
          <Card tone="yellow">
            <span className="t">Scanning is not on for your account</span>
            <span className="s">Ask an admin to add the attendance scan permission to your role under Admin users.</span>
          </Card>
        ) : (
          <>
            <div className="-mx-4">
              <PermissionsPrompt />
            </div>
            <Card tone="ink" className="items-center gap-3 py-6">
              {/* Never use display:none on the video — Android Chrome often fails getUserMedia/play when the element is not rendered. */}
              <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-xl bg-ink">
                <video
                  ref={scanner.videoRef}
                  className={`absolute inset-0 size-full object-cover ${scanner.isScanning ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                  muted
                  playsInline
                  autoPlay
                />
                {!scanner.isScanning && (
                  <div className="absolute inset-0 grid place-items-center border-[3px] border-dashed border-sun px-4 text-center font-extrabold text-sun">
                    {scanner.isRequestingPermission ? 'Waiting for Allow… check the TOP of the screen' : 'Camera view'}
                  </div>
                )}
              </div>
              <span className="s">Point at the participant’s badge or app QR</span>
              {scanner.isSupported ? (
                <Button
                  className="w-full"
                  icon={ScanLine}
                  variant="accent"
                  disabled={scanner.isRequestingPermission}
                  onClick={() => {
                    if (scanner.isScanning) {
                      scanner.stop()
                      return
                    }
                    // Ensure the permissions card can resurface if camera was blocked earlier.
                    if (scanner.error) requestSetup()
                    scanner.start()
                  }}
                >
                  {scanner.isScanning ? 'Stop camera' : scanner.isRequestingPermission ? 'Waiting for Allow…' : 'Start scanning'}
                </Button>
              ) : (
                <p className="s">This browser cannot scan with the camera. Type the delegate ID or badge code below.</p>
              )}
              {scanner.error && (
                <div className="flex w-full flex-col gap-2">
                  <p className="text-sm font-bold text-sun">{scanner.error}</p>
                  <Button
                    className="w-full"
                    variant="ghost"
                    onClick={() => {
                      requestSetup()
                      scanner.start()
                    }}
                  >
                    Try camera again
                  </Button>
                  {isStandaloneDisplay() && (
                    <Button className="w-full" variant="ghost" onClick={openAppInBrowserForCamera}>
                      Open in Chrome to allow camera
                    </Button>
                  )}
                </div>
              )}
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
              <div className="flex flex-col gap-2">
                {printLabel && <Badge tone={printLabel[1]}>{printLabel[0]}</Badge>}
                {person.badge_issued_at && <Badge tone="teal">Issued</Badge>}
                <ScanPersonCard person={person} busy={busy} onCheckIn={checkIn} />
                {hasBadgeDesk && (
                  <Card className="flex flex-col gap-2">
                    <span className="t">Badge desk actions</span>
                    {person.can_issue && (
                      <Button className="w-full" variant="accent" disabled={busy} onClick={issueBadge}>
                        {person.badge_issued_at ? 'Re-issue badge' : 'Issue badge'}
                      </Button>
                    )}
                    {person.print_status === 'reprint_needed' && (
                      <span className="s">Reprint on the web print desk.</span>
                    )}
                    {!person.can_issue && person.issue_block && (
                      <span className="s">{person.issue_block}</span>
                    )}
                  </Card>
                )}
              </div>
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
