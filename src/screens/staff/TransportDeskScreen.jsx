import Card from '../../components/ui/Card'
import { useState } from 'react'
import ParkingPassCard from '../../components/ParkingPassCard'
import { LoadState } from '../../components/ui/LoadState'
import { api } from '../../lib/api'
import {
  isProbablyOfflineError,
  lookupScan,
  rememberScan,
} from '../../lib/staffOffline'
import { useBarcodeScanner } from '../../lib/useBarcodeScanner'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

const MET = ['collected', 'at_hotel', 'landed', 'car_arrived']
const ARRIVED_OK = ['assigned', 'en_route', 'delayed', 'landed', 'collected']
const LEVELS = [['vip', 'VIP'], ['staff', 'Staff'], ['delegate', 'Delegate']]

/** A transport desk's list with the wireframe's one action per row. */
export default function TransportDeskScreen({ desk }) {
  const slug = useEventSlug()
  const base = `/events/${encodeURIComponent(slug)}/transport-desk`
  const showToast = useAppStore((state) => state.showToast)
  const { data, loading, error, reload } = useRemote(`${base}/${desk}`)
  const rows = data?.data?.rows ?? []
  const [busy, setBusy] = useState(null)
  const [onBoard, setOnBoard] = useState({})

  async function act(key, path, body, message) {
    setBusy(key)
    try {
      await api(path, { method: 'POST', body })
      showToast(message)
      reload()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(null)
    }
  }

  return (
    <LoadState loading={loading && !data} error={error} onRetry={reload}>
      {desk === 'parking' && <ParkingTools base={base} onDone={reload} />}
      {rows.length === 0 && desk !== 'parking' && <div className="empty">Nothing to show yet.</div>}
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <Card key={`${desk}-${row.id}`} className="card flex flex-col gap-2">
            <div className="row">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t">{row.title}</span>
                {row.detail && <span className="s">{row.detail}</span>}
                {row.car && <span className="s">Car {row.car}{row.protocol ? ` · ${row.protocol}` : ''}</span>}
                {row.checked_in_by && <span className="s">Checked in by {row.checked_in_by}</span>}
              </div>
              {typeof row.waiting === 'number' && <span className={`pill ${row.waiting ? 'y' : ''}`}>{row.waiting} waiting</span>}
              {typeof row.spaces === 'number' && <span className="pill">{row.spaces} spaces</span>}
              {row.status && <span className="pill">{String(row.status).replace(/_/g, ' ')}</span>}
            </div>

            {desk === 'venue' && (
              onBoard[row.id] === undefined ? (
                <button type="button" className="btn y sm" onClick={() => setOnBoard({ ...onBoard, [row.id]: '' })}>Depart</button>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="80" inputMode="numeric" aria-label="People on board" placeholder="People on board" value={onBoard[row.id]} onChange={(e) => setOnBoard({ ...onBoard, [row.id]: e.target.value })} />
                  <button type="button" className="btn sm" disabled={busy === `dep-${row.id}` || onBoard[row.id] === ''} onClick={() => act(`dep-${row.id}`, `${base}/routes/${row.id}/depart`, { passengers_on_board: Number(onBoard[row.id]) }, 'Departure recorded')}>Confirm</button>
                </div>
              )
            )}

            {desk === 'hotel' && row.status !== 'checked_in' && (
              <button type="button" className="btn y sm" disabled={busy === `in-${row.id}`} onClick={() => act(`in-${row.id}`, `${base}/guests/${row.id}/check-in`, {}, `${row.title} checked in`)}>Check in</button>
            )}

            {desk === 'car' && ARRIVED_OK.includes(row.status) && (
              <button type="button" className="btn y sm" disabled={busy === `car-${row.id}`} onClick={() => act(`car-${row.id}`, `${base}/arrivals/${row.id}/car-arrived`, {}, 'Car marked as arrived')}>Arrived</button>
            )}

            {desk === 'protocol' && !MET.includes(row.status) && (
              <button type="button" className="btn y sm" disabled={busy === `met-${row.id}`} onClick={() => act(`met-${row.id}`, `${base}/arrivals/${row.id}/met`, {}, `${row.title} marked as met`)}>Met</button>
            )}
          </Card>
        ))}
      </div>
    </LoadState>
  )
}

/** Parking usher: scan a pass's QR code (or type the code) to see its level. Transport managers issue passes. */
function ParkingTools({ base, onDone }) {
  const slug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const [code, setCode] = useState('')
  const [level, setLevel] = useState('delegate')
  const [result, setResult] = useState(null)

  async function check(value) {
    const passCode = String(value ?? '').trim()
    if (!passCode) return
    try {
      const { data } = await api(`${base}/parking/scan`, { method: 'POST', body: { code: passCode } })
      const payload = { ...data, code: data.code || passCode.toUpperCase(), valid: true }
      setResult(payload)
      await rememberScan(slug, passCode, payload, 'parking')
    } catch (err) {
      if (isProbablyOfflineError(err)) {
        const cached = await lookupScan(slug, passCode)
        if (cached && cached.level) {
          setResult({ ...cached, offline_cached: true })
          showToast('Showing cached pass (offline)', 'info')
          return
        }
      }
      setResult({ error: true, valid: false })
    }
  }

  const scanner = useBarcodeScanner((value) => {
    scanner.stop()
    setCode(value)
    check(value)
  })

  async function issue() {
    try {
      const { data } = await api(`${base}/parking/passes`, { method: 'POST', body: { level } })
      showToast(`Pass ${data.code} issued`)
      onDone()
    } catch (err) {
      showToast(err.message, 'info')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="card flex flex-col gap-2">
        <span className="t">Scan a pass</span>
        <span className="s">Point at the parking pass QR, or type the code, to confirm the lot.</span>
        <video ref={scanner.videoRef} className={`aspect-square w-full rounded-xl bg-ink object-cover ${scanner.isScanning ? '' : 'hidden'}`} muted playsInline />
        {scanner.isSupported && (
          <button type="button" className="btn y sm" onClick={scanner.isScanning ? scanner.stop : scanner.start}>{scanner.isScanning ? 'Stop camera' : 'Scan QR'}</button>
        )}
        {scanner.error && <span className="text-sm font-bold text-maroon">{scanner.error}</span>}
        <div className="flex items-center gap-2">
          <input aria-label="Pass code" placeholder="Pass code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
          <button type="button" className="btn sm" disabled={!code.trim()} onClick={() => check(code.trim())}>Check</button>
        </div>
      </Card>
      {result && <ParkingPassCard result={result} />}
      <Card className="card flex flex-col gap-2">
        <span className="t">Issue a pass</span>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map(([value, label]) => (
            <button key={value} type="button" className={`btn sm ${level === value ? 'y' : 'o'}`} onClick={() => setLevel(value)}>{label}</button>
          ))}
        </div>
        <button type="button" className="btn sm" onClick={issue}>Issue pass</button>
        <span className="s">Transport managers only.</span>
      </Card>
    </div>
  )
}
