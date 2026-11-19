import Card from '../../components/ui/Card'
import { useCallback, useEffect, useRef, useState } from 'react'
import ScanPersonCard from '../../components/ScanPersonCard'
import Badge from '../../components/ui/Badge'
import ScreenHeader, { Body, Chips } from '../../components/ui/ScreenHeader'
import SearchField from '../../components/ui/SearchField'
import { api } from '../../lib/api'
import { isProbablyOfflineError, lookupScan, rememberScan } from '../../lib/staffOffline'
import PermissionCoachBanner from '../../components/PermissionCoachBanner'
import { isStandaloneDisplay, openAppInBrowserForCamera } from '../../lib/camera'
import { useBarcodeScanner } from '../../lib/useBarcodeScanner'
import { useEventSlug } from '../../lib/useParticipant'
import { useRefreshListener } from '../../lib/useRefreshListener'
import { useAppStore } from '../../store/appStore'

const PRINT_STATUS = {
  not_printed: ['Not printed', 'y'],
  reprint_needed: ['Reprint needed', 'm'],
  printed: ['Printed · current', 't'],
}
const SEARCH_DELAY_MS = 300

function printStatusOf(person) {
  return person?.print_status || person?.status
}

/** Badge desk: issue (incl. multi-issue), reprint, and check a scanned badge. */
export default function BadgeDeskScreen() {
  const slug = useEventSlug()
  const base = `/events/${encodeURIComponent(slug)}/badge-desk`
  const showToast = useAppStore((state) => state.showToast)
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({
    printed: 0,
    awaiting_issue: 0,
    in_queue: 0,
    printed_today: 0,
    issued_today: 0,
    reprints: 0,
  })
  const [page, setPage] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reason, setReason] = useState({})
  const [busy, setBusy] = useState(null)
  const [checked, setChecked] = useState(null)
  const [code, setCode] = useState('')
  const [issueTab, setIssueTab] = useState('single') // single | multiple
  const [scanMode, setScanMode] = useState('check') // check | collector | badges
  const [collector, setCollector] = useState(null)
  const [badgeIdsText, setBadgeIdsText] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)
  const sentinel = useRef(null)
  const loadingRef = useRef(false)
  const toastAtRef = useRef(0)
  const scanModeRef = useRef(scanMode)
  const scannerControlsRef = useRef({ start: async () => {}, stop: () => {} })
  scanModeRef.current = scanMode

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  async function loadPage(nextPage, search, signal, replace = false) {
    if (loadingRef.current && !replace) return
    loadingRef.current = true
    setLoading(true)
    setFailed(false)
    try {
      const qs = new URLSearchParams({ page: String(nextPage), ...(search ? { q: search } : {}) })
      const payload = await api(`${base}?${qs}`, { signal })
      setRows((current) => (replace ? payload.data.rows : [...current, ...payload.data.rows]))
      setStats(payload.data.stats)
      setPage(payload.meta.current_page)
      setLastPage(Math.max(1, payload.meta.last_page || 1))
      setFailed(false)
    } catch (err) {
      if (err.name === 'AbortError') return
      setPage(nextPage)
      setLastPage(nextPage)
      setFailed(true)
      const now = Date.now()
      if (now - toastAtRef.current > 4000) {
        toastAtRef.current = now
        showToast(err.message || 'Server Error', 'info')
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    setRows([])
    setPage(0)
    setLastPage(1)
    setFailed(false)
    loadPage(1, term, controller.signal, true)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, slug])

  useRefreshListener(() => {
    setRows([])
    setPage(0)
    setLastPage(1)
    setFailed(false)
    loadPage(1, term, undefined, true)
  })

  useEffect(() => {
    const node = sentinel.current
    if (!node || loading || failed || page >= lastPage) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadPage(page + 1, term)
    }, { rootMargin: '200px' })
    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lastPage, loading, failed, term])

  async function issueOne(row) {
    setBusy(row.id)
    try {
      await api(`${base}/registrations/${row.id}/issue`, { method: 'POST', body: {} })
      showToast(`${row.name} issued`)
      setFailed(false)
      if (checked?.id === row.id) {
        const { data } = await api(`${base}/verify`, { method: 'POST', body: { scan_payload: String(row.badge_id || row.id) } })
        setChecked(data)
      }
      loadPage(1, term, undefined, true)
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(null)
    }
  }

  async function reprint(row) {
    if (!reason[row.id]?.trim()) {
      showToast('Add a reason for the reprint first', 'info')
      return
    }
    setBusy(row.id)
    try {
      await api(`${base}/registrations/${row.id}/reprint`, {
        method: 'POST',
        body: { reprint_reason: reason[row.id].trim() },
      })
      showToast(`${row.name} reprinted`)
      setReason({ ...reason, [row.id]: '' })
      setFailed(false)
      loadPage(1, term, undefined, true)
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(null)
    }
  }

  const resumeCamera = useCallback((mode) => {
    if (mode === 'collector' || mode === 'badges') {
      queueMicrotask(() => {
        scannerControlsRef.current.start().catch(() => {})
      })
    }
  }, [])

  async function verify(payload) {
    const value = String(payload ?? '').trim()
    if (!value) return
    const mode = scanModeRef.current
    try {
      const { data } = await api(`${base}/verify`, { method: 'POST', body: { scan_payload: value } })
      if (mode === 'collector') {
        setCollector(data)
        setScanMode('badges')
        showToast(`Collector: ${data.name}`)
        resumeCamera('badges')
        return
      }
      if (mode === 'badges') {
        const id = data.badge_id != null ? String(data.badge_id) : String(data.id)
        setBadgeIdsText((current) => {
          const parts = current.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean)
          if (parts.includes(id)) return current
          return parts.length ? `${parts.join(', ')}, ${id}` : id
        })
        showToast(`Added badge ${id}`)
        resumeCamera('badges')
        return
      }
      setChecked(data)
      await rememberScan(slug, value, data, 'badge')
    } catch (err) {
      if (mode === 'check' && isProbablyOfflineError(err)) {
        const cached = await lookupScan(slug, value)
        if (cached) {
          setChecked(cached)
          showToast('Showing cached badge (offline)', 'info')
          return
        }
      }
      if (mode === 'check') setChecked({ error: true })
      else {
        showToast(err.message || 'Lookup failed', 'info')
        resumeCamera(mode)
      }
    }
  }

  async function issueBatch() {
    if (!collector?.id) {
      showToast('Scan the person picking up first', 'info')
      return
    }
    if (!badgeIdsText.trim()) {
      showToast('Add badge IDs to issue', 'info')
      return
    }
    setBatchBusy(true)
    try {
      const { data } = await api(`${base}/issue-batch`, {
        method: 'POST',
        body: {
          collector_registration_id: collector.id,
          badge_ids_text: badgeIdsText.trim(),
        },
      })
      const count = data.issued_count ?? data.issued?.length ?? 0
      showToast(`Issued ${count} badge${count === 1 ? '' : 's'}`)
      if (data.errors?.length) {
        showToast(`${data.errors.length} could not be issued`, 'info')
      }
      setBadgeIdsText('')
      setCollector(null)
      setScanMode('collector')
      scanModeRef.current = 'collector'
      scannerControlsRef.current.stop()
      loadPage(1, term, undefined, true)
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBatchBusy(false)
    }
  }

  const onScanDetected = useCallback((value) => {
    scannerControlsRef.current.stop()
    verify(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- verify closes over latest slug/showToast via render
  }, [slug, showToast, resumeCamera])

  const scanner = useBarcodeScanner(onScanDetected)
  scannerControlsRef.current = { start: scanner.start, stop: scanner.stop }

  function startScan(mode) {
    setScanMode(mode)
    scanModeRef.current = mode
    if (!scanner.isScanning) scanner.start()
    queueMicrotask(() => {
      document.getElementById('badge-desk-camera')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function switchIssueTab(next) {
    if (next === issueTab) return
    setIssueTab(next)
    scanner.stop()
    if (next === 'single') {
      setScanMode('check')
      scanModeRef.current = 'check'
    } else if (scanMode === 'check') {
      setScanMode(collector ? 'badges' : 'collector')
      scanModeRef.current = collector ? 'badges' : 'collector'
    }
  }

  const scanLabel =
    scanMode === 'collector' ? 'Point at the person picking up the badges'
      : scanMode === 'badges' ? 'Point at each badge QR to add its ID'
        : 'Point at the delegate’s badge or app QR'

  const printTone = (key) => {
    const tone = PRINT_STATUS[key]?.[1]
    return tone === 'm' ? 'maroon' : tone === 't' ? 'teal' : 'sun'
  }

  const cameraCard = (
    /* Video must stay laid out (not sr-only / display:none) or Android Chrome denies getUserMedia with no dialog. */
    <Card id="badge-desk-camera" className="card flex flex-col gap-2">
      <span className="t">Camera</span>
      <span className="s">
        {scanner.isRequestingPermission
          ? 'Waiting for Allow… on the APK this is the same system dialog as notifications. In the Chrome installed app, Allow camera once in Chrome first.'
          : scanLabel}
      </span>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-ink">
        <video
          ref={scanner.videoRef}
          className={`absolute inset-0 size-full object-cover ${scanner.isScanning ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          muted
          playsInline
          autoPlay
        />
        {!scanner.isScanning && (
          <div className="absolute inset-0 grid place-items-center border-[3px] border-dashed border-sun px-4 text-center font-extrabold text-sun">
            {scanner.isRequestingPermission ? 'Waiting for Allow…' : 'Camera view'}
          </div>
        )}
      </div>
      {scanner.isSupported && scanner.isScanning && (
        <button type="button" className="btn sm" onClick={() => scanner.stop()}>
          Stop camera
        </button>
      )}
      {scanner.error && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-maroon">{scanner.error}</span>
          {isStandaloneDisplay() && (
            <button type="button" className="btn o sm" onClick={openAppInBrowserForCamera}>
              Open in Chrome to allow camera
            </button>
          )}
        </div>
      )}
    </Card>
  )

  return (
    <>
      <PermissionCoachBanner active={scanner.isRequestingPermission} />
      <ScreenHeader kicker="Badge desk" title="Issue and reprint" tone="teal" />
      <Body>
        <div className="kpi">
          <div><b>{stats.printed ?? stats.in_queue ?? 0}</b><span>printed</span></div>
          <div><b>{stats.awaiting_issue ?? stats.in_queue ?? 0}</b><span>awaiting issue</span></div>
          <div><b>{stats.issued_today ?? 0}</b><span>issued today</span></div>
          <div><b>{stats.reprints ?? 0}</b><span>reprints</span></div>
        </div>

        <Chips
          label="Issue mode"
          light
          value={issueTab}
          onChange={switchIssueTab}
          options={[
            { id: 'single', label: 'Single issue' },
            { id: 'multiple', label: 'Multiple issue' },
          ]}
        />

        {issueTab === 'multiple' && (
          <Card className="card flex flex-col gap-2">
            <span className="t">Issue multiple badges</span>
            <span className="s">Scan the person picking up, then scan or type every badge ID they are taking (comma-separated).</span>
            {collector ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-mint-soft/60 px-3 py-2">
                <span className="text-sm font-bold">{collector.name}{collector.badge_id != null ? ` · badge ${collector.badge_id}` : ''}</span>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setCollector(null)
                    startScan('collector')
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn y sm"
                onClick={() => startScan('collector')}
              >
                {scanner.isScanning && scanMode === 'collector' ? 'Scanning person…' : 'Scan person picking up'}
              </button>
            )}
            <label className="flex flex-col gap-1">
              <span className="lab">Badge IDs</span>
              <textarea
                aria-label="Badge IDs"
                rows={2}
                placeholder="e.g. 1201, 1202, 1203"
                value={badgeIdsText}
                onChange={(e) => setBadgeIdsText(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2 font-mono text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn sm"
                onClick={() => startScan('badges')}
                disabled={!collector}
              >
                {scanner.isScanning && scanMode === 'badges' ? 'Scanning badges…' : 'Scan badge IDs'}
              </button>
              <button type="button" className="btn y sm" disabled={batchBusy || !collector || !badgeIdsText.trim()} onClick={issueBatch}>
                {batchBusy ? 'Issuing…' : 'Issue all'}
              </button>
            </div>
          </Card>
        )}

        {cameraCard}

        {issueTab === 'single' && (
          <>
            <Card className="card flex flex-col gap-2">
              <span className="t">Check a badge</span>
              <span className="s">Scan the delegate’s QR to see their access and whether the printed badge is the latest version.</span>
              {scanner.isSupported && (
                <button
                  type="button"
                  className="btn y sm"
                  onClick={() => {
                    if (scanner.isScanning && scanMode === 'check') {
                      scanner.stop()
                      return
                    }
                    startScan('check')
                  }}
                >
                  {scanner.isScanning && scanMode === 'check' ? 'Stop camera' : 'Scan QR'}
                </button>
              )}
              <div className="flex items-center gap-2">
                <input
                  aria-label="Badge code"
                  placeholder="Badge code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onFocus={() => {
                    setScanMode('check')
                    scanModeRef.current = 'check'
                  }}
                />
                <button
                  type="button"
                  className="btn sm"
                  disabled={!code.trim()}
                  onClick={() => {
                    setScanMode('check')
                    scanModeRef.current = 'check'
                    verify(code.trim())
                  }}
                >
                  Check
                </button>
              </div>
              {checked?.error && <span className="pill m">Not a valid badge</span>}
            </Card>
            {checked && !checked.error && (
              <div className="flex flex-col gap-2">
                {PRINT_STATUS[printStatusOf(checked)] && (
                  <Badge tone={printTone(printStatusOf(checked))}>
                    {PRINT_STATUS[printStatusOf(checked)][0]}
                  </Badge>
                )}
                {checked.badge_issued_at && <Badge tone="teal">Issued</Badge>}
                <ScanPersonCard person={checked} showCheckIn={false} />
                <div className="flex flex-col gap-2">
                  {checked.can_issue && (
                    <button type="button" className="btn y sm" disabled={busy === checked.id} onClick={() => issueOne(checked)}>
                      {checked.badge_issued_at ? 'Re-issue' : 'Issue'}
                    </button>
                  )}
                  {checked.can_reprint && (
                    <>
                      <input
                        aria-label={`Reprint reason for ${checked.name}`}
                        placeholder="Reason for reprint"
                        value={reason[checked.id] ?? ''}
                        onChange={(e) => setReason({ ...reason, [checked.id]: e.target.value })}
                      />
                      <button type="button" className="btn sm" disabled={busy === checked.id} onClick={() => reprint(checked)}>
                        Reprint
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <SearchField label="Search printed badges" value={query} onChange={setQuery} placeholder="Name or email" />

            <ul className="flex flex-col gap-2.5">
              {rows.map((row) => {
                const statusKey = printStatusOf(row) || 'not_printed'
                const [label, tone] = PRINT_STATUS[statusKey] ?? PRINT_STATUS.not_printed
                return (
                  <li key={row.id}><Card className="flex flex-col gap-2">
                    <div className="row">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-bold">{row.name}</span>
                        <span className="truncate text-[12px] text-muted">{[row.badge_type, row.badge_id ? `badge ${row.badge_id}` : null].filter(Boolean).join(' · ')}</span>
                        {(row.has_plenary_access || row.has_car_parking_access || row.has_redzone_plenary_access) && (
                          <span className="truncate text-[12px] text-muted">
                            {[
                              row.has_plenary_access ? 'Plenary' : null,
                              row.has_car_parking_access ? 'Parking' : null,
                              row.has_redzone_plenary_access ? 'Redzone' : null,
                            ].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge tone={tone === 'm' ? 'maroon' : tone === 't' ? 'teal' : 'sun'}>{label}</Badge>
                        {row.issued || row.badge_issued_at ? <Badge tone="teal">Issued</Badge> : null}
                      </div>
                    </div>
                    {row.can_issue && (
                      <button type="button" className="btn y sm" disabled={busy === row.id} onClick={() => issueOne(row)}>
                        {row.issued || row.badge_issued_at ? 'Re-issue' : 'Issue'}
                      </button>
                    )}
                    {!row.can_issue && row.issue_block && (
                      <span className="text-[12px] text-muted">{row.issue_block}</span>
                    )}
                    {row.can_reprint && (
                      <>
                        <input
                          aria-label={`Reprint reason for ${row.name}`}
                          placeholder="Reason for reprint"
                          value={reason[row.id] ?? ''}
                          onChange={(e) => setReason({ ...reason, [row.id]: e.target.value })}
                        />
                        <button type="button" className="btn sm" disabled={busy === row.id} onClick={() => reprint(row)}>
                          Reprint
                        </button>
                      </>
                    )}
                  </Card></li>
                )
              })}
            </ul>
            {failed && rows.length === 0 && !loading && (
              <div className="empty flex flex-col items-center gap-2">
                <span>Couldn’t load printed badges.</span>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setFailed(false)
                    setLastPage(1)
                    loadPage(1, term, undefined, true)
                  }}
                >
                  Try again
                </button>
              </div>
            )}
            {rows.length === 0 && !loading && !failed && <div className="empty">{term ? `Nobody in printed history matches “${term}”.` : 'No printed badges yet — print on the web desk first.'}</div>}
            {!failed && (loading || page < lastPage) && <div ref={sentinel} className="py-4 text-center text-[13px] text-muted" role="status">{loading ? 'Loading…' : ''}</div>}
          </>
        )}
      </Body>
    </>
  )
}
