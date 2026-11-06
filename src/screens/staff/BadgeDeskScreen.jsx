import Card from '../../components/ui/Card'
import { useEffect, useRef, useState } from 'react'
import ScanPersonCard from '../../components/ScanPersonCard'
import Badge from '../../components/ui/Badge'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import SearchField from '../../components/ui/SearchField'
import { api } from '../../lib/api'
import { isProbablyOfflineError, lookupScan, rememberScan } from '../../lib/staffOffline'
import { useBarcodeScanner } from '../../lib/useBarcodeScanner'
import { useEventSlug } from '../../lib/useParticipant'
import { useRefreshListener } from '../../lib/useRefreshListener'
import { useAppStore } from '../../store/appStore'

const STATUS = {
  not_printed: ['Not printed', 'y'],
  reprint_needed: ['Reprint needed', 'm'],
  printed: ['Printed · current', 't'],
}
const SEARCH_DELAY_MS = 300

/** Badge desk: the print queue, printing and reprinting, and checking a scanned badge is the latest version. */
export default function BadgeDeskScreen() {
  const slug = useEventSlug()
  const base = `/events/${encodeURIComponent(slug)}/badge-desk`
  const showToast = useAppStore((state) => state.showToast)
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({ in_queue: 0, printed_today: 0, reprints: 0 })
  const [page, setPage] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState({})
  const [busy, setBusy] = useState(null)
  const [checked, setChecked] = useState(null)
  const [code, setCode] = useState('')
  const sentinel = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  async function loadPage(nextPage, search, signal, replace = false) {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: nextPage, ...(search ? { q: search } : {}) })
      const payload = await api(`${base}?${qs}`, { signal })
      setRows((current) => (replace ? payload.data.rows : [...current, ...payload.data.rows]))
      setStats(payload.data.stats)
      setPage(payload.meta.current_page)
      setLastPage(payload.meta.last_page)
    } catch (err) {
      if (err.name !== 'AbortError') showToast(err.message, 'info')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    setRows([])
    setPage(0)
    loadPage(1, term, controller.signal, true)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, slug])

  useRefreshListener(() => {
    setRows([])
    setPage(0)
    loadPage(1, term, undefined, true)
  })

  useEffect(() => {
    const node = sentinel.current
    if (!node || loading || page >= lastPage) return undefined
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadPage(page + 1, term), { rootMargin: '200px' })
    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lastPage, loading, term])

  async function print(row) {
    const needsReason = row.status !== 'not_printed'
    if (needsReason && !reason[row.id]?.trim()) {
      showToast('Add a reason for the reprint first', 'info')
      return
    }
    setBusy(row.id)
    try {
      await api(`${base}/registrations/${row.id}/print`, { method: 'POST', body: needsReason ? { reprint_reason: reason[row.id].trim() } : {} })
      showToast(needsReason ? `${row.name} reprinted` : `${row.name} printed`)
      setReason({ ...reason, [row.id]: '' })
      loadPage(1, term, undefined, true)
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(null)
    }
  }

  async function verify(payload) {
    const value = String(payload ?? '').trim()
    if (!value) return
    try {
      const { data } = await api(`${base}/verify`, { method: 'POST', body: { scan_payload: value } })
      setChecked(data)
      await rememberScan(slug, value, data, 'badge')
    } catch (err) {
      if (isProbablyOfflineError(err)) {
        const cached = await lookupScan(slug, value)
        if (cached) {
          setChecked(cached)
          showToast('Showing cached badge (offline)', 'info')
          return
        }
      }
      setChecked({ error: true })
    }
  }

  const scanner = useBarcodeScanner((value) => {
    scanner.stop()
    verify(value)
  })

  return (
    <>
      <ScreenHeader kicker="Badge desk" title="Print and reprint" tone="teal" />
      <Body>
        <div className="kpi">
          <div><b>{stats.in_queue}</b><span>in queue</span></div>
          <div><b>{stats.printed_today}</b><span>printed today</span></div>
          <div><b>{stats.reprints}</b><span>reprints</span></div>
        </div>

        <Card className="card flex flex-col gap-2">
          <span className="t">Check a badge</span>
          <span className="s">Scan the delegate’s QR to see their access and whether the printed badge is the latest version.</span>
          <video ref={scanner.videoRef} className={`aspect-square w-full rounded-xl bg-ink object-cover ${scanner.isScanning ? '' : 'hidden'}`} muted playsInline />
          {scanner.isSupported && (
            <button type="button" className="btn y sm" onClick={scanner.isScanning ? scanner.stop : scanner.start}>{scanner.isScanning ? 'Stop camera' : 'Scan QR'}</button>
          )}
          {scanner.error && <span className="text-sm font-bold text-maroon">{scanner.error}</span>}
          <div className="flex items-center gap-2">
            <input aria-label="Badge code" placeholder="Badge code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button type="button" className="btn sm" disabled={!code.trim()} onClick={() => verify(code.trim())}>Check</button>
          </div>
          {checked?.error && <span className="pill m">Not a valid badge</span>}
        </Card>
        {checked && !checked.error && (
          <div className="flex flex-col gap-2">
            {STATUS[checked.status] && (
              <Badge tone={STATUS[checked.status][1] === 'm' ? 'maroon' : STATUS[checked.status][1] === 't' ? 'teal' : 'sun'}>
                {STATUS[checked.status][0]}
              </Badge>
            )}
            <ScanPersonCard person={checked} showCheckIn={false} />
          </div>
        )}

        <SearchField label="Search the queue" value={query} onChange={setQuery} placeholder="Name or email" />

        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => {
            const [label, tone] = STATUS[row.status] ?? STATUS.not_printed
            const isReprint = row.status !== 'not_printed'
            return (
              <li key={row.id}><Card className="flex flex-col gap-2">
                <div className="row">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold">{row.name}</span>
                    <span className="truncate text-[12px] text-muted">{[row.badge_type, row.badge_id ? `badge ${row.badge_id}` : null].filter(Boolean).join(' · ')}</span>
                  </div>
                  <Badge tone={tone === 'm' ? 'maroon' : tone === 't' ? 'teal' : 'sun'}>{label}</Badge>
                </div>
                {isReprint && <input aria-label={`Reprint reason for ${row.name}`} placeholder="Reason for reprint" value={reason[row.id] ?? ''} onChange={(e) => setReason({ ...reason, [row.id]: e.target.value })} />}
                <button type="button" className="btn y sm" disabled={busy === row.id || !row.can_print} onClick={() => print(row)}>
                  {row.can_print ? (isReprint ? 'Reprint' : 'Print') : row.print_block ?? 'Not ready'}
                </button>
              </Card></li>
            )
          })}
        </ul>
        {rows.length === 0 && !loading && <div className="empty">{term ? `Nobody in the queue matches “${term}”.` : 'The print queue is empty.'}</div>}
        {(loading || page < lastPage) && <div ref={sentinel} className="py-4 text-center text-[13px] text-muted" role="status">{loading ? 'Loading…' : ''}</div>}
      </Body>
    </>
  )
}

