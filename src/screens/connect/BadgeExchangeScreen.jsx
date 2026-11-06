import Card from '../../components/ui/Card'
import ListRow from '../../components/ui/ListRow'
import { useState } from 'react'
import { ScanLine } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import Avatar from '../../components/ui/Avatar'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { api, listOf } from '../../lib/api'
import { useBarcodeScanner } from '../../lib/useBarcodeScanner'
import { useEventSlug, useRegistration } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'
import { useSessionStore } from '../../store/sessionStore'
import { useBrandStore } from '../../store/brandStore'

/** Reads the native app's exchange QR ({"type":"cphia_badge_exchange","id":...}) or a bare public id. */
function publicIdFrom(raw) {
  const text = raw.trim()
  try {
    const parsed = JSON.parse(text)
    if (parsed?.type === 'cphia_badge_exchange' && parsed.id) return String(parsed.id)
  } catch {
    // Not JSON: treat as a public id.
  }
  return text
}

/** My digital card: show your QR, scan another delegate's (same format as the native app), cards received. */
export default function BadgeExchangeScreen() {
  const slug = useEventSlug()
  const user = useSessionStore((state) => state.user)
  const theme = useBrandStore((state) => state.theme)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const showToast = useAppStore((state) => state.showToast)
  const { registration } = useRegistration()
  const [manual, setManual] = useState('')
  const connections = useRemote(`/events/${encodeURIComponent(slug)}/connections`)

  async function save(raw) {
    const publicId = publicIdFrom(raw)
    try {
      await api(`/events/${encodeURIComponent(slug)}/connections`, { method: 'POST', body: { registration_public_id: publicId } })
      showToast('Contact saved')
      navigateTo('attendee', { publicId })
    } catch (err) {
      showToast(err.status === 404 ? 'That delegate is not in the directory.' : err.message, 'info')
    }
  }

  const scanner = useBarcodeScanner((value) => {
    scanner.stop()
    save(value)
  })

  const exchangeQr = registration?.public_id
    ? JSON.stringify({ type: 'cphia_badge_exchange', id: registration.public_id, name: user?.name })
    : null
  const contacts = listOf(connections.data)

  async function share() {
    const text = `${user?.name}${user?.organization ? `, ${user.organization}` : ''}. My CPHIA 2026 delegate ID: ${registration?.public_id}`
    try {
      if (navigator.share) await navigator.share({ title: 'My CPHIA 2026 card', text })
      else {
        await navigator.clipboard.writeText(text)
        showToast('Card details copied')
      }
    } catch {
      // Share sheet closed.
    }
  }

  return (
    <>
      <ScreenHeader kicker="Digital business card" title="My card" back />
      <Body>
        <div className="flex flex-col gap-1.5 rounded-2xl bg-ink p-4 text-cream">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-lg font-black">{user?.name}</span>
              {user?.organization && <span className="text-xs text-pale">{user.organization}</span>}
              {user?.job_title && <span className="text-xs text-pale">{user.job_title}</span>}
              {user?.interests?.length > 0 && <span className="text-xs text-pale">{user.interests.join(' · ')}</span>}
            </div>
            {exchangeQr && <span className="shrink-0 rounded-lg bg-cream p-1.5"><QRCodeSVG value={exchangeQr} size={96} bgColor={theme.surface} fgColor={theme.ink} title="My contact QR code" /></span>}
          </div>
          <span className="text-xs font-bold text-sun">{exchangeQr ? 'Scan to receive my card' : 'Your card QR appears once your registration is approved'}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {scanner.isSupported ? (
            <button type="button" className="btn y" onClick={scanner.isScanning ? scanner.stop : scanner.start}>
              <ScanLine size={18} aria-hidden="true" />{scanner.isScanning ? 'Stop camera' : 'Scan their QR'}
            </button>
          ) : (
            <span className="s self-center">This browser cannot use the camera. Enter their delegate ID below.</span>
          )}
          <button type="button" className="btn o" disabled={!registration?.public_id} onClick={share}>Share my card</button>
        </div>
        <video ref={scanner.videoRef} className={`aspect-square w-full rounded-xl bg-ink object-cover ${scanner.isScanning ? '' : 'hidden'}`} muted playsInline />
        {scanner.error && <p className="text-sm font-bold text-maroon">{scanner.error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) save(manual) }} className="flex gap-2">
          <label htmlFor="exchange-id" className="sr-only">Delegate ID</label>
          <input id="exchange-id" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or enter their delegate ID" className="min-w-0 flex-1" />
          <button type="submit" className="btn o sm h-auto">Save</button>
        </form>

        <h2 className="h3">Cards received ({contacts.length})</h2>
        <Card className="card gap-0">
          {contacts.length === 0 && <div className="empty">No cards yet. Connect from the delegate list or scan a badge.</div>}
          {contacts.map((contact) => (
            <ListRow key={contact.id} onClick={() => navigateTo('attendee', { publicId: contact.registration_public_id })}>
              <Avatar name={contact.name} photoUrl={contact.photo_url} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t">{contact.name}</span>
                <span className="s">{[contact.job_title, contact.organization].filter(Boolean).join(' · ')}</span>
              </span>
            </ListRow>
          ))}
        </Card>
      </Body>
    </>
  )
}
