import { useCallback, useEffect, useRef, useState } from 'react'
import { api, DEFAULT_EVENT_SLUG } from '../lib/api'
import { checkForAppUpdate } from '../lib/appUpdate'
import { applyTheme, useBrandStore } from '../store/brandStore'
import { useRefreshStore } from '../store/refreshStore'
import { useSessionStore } from '../store/sessionStore'

const THRESHOLD = 72
const MAX_PULL = 128
const MIN_SPIN_MS = 550

function resistance(dy) {
  if (dy <= 0) return 0
  return Math.min(MAX_PULL, dy * 0.42 + Math.pow(Math.min(dy, 180), 0.72) * 0.35)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function refreshSessionAndBrand() {
  const token = useSessionStore.getState().token
  const slug = useSessionStore.getState().eventSlug ?? DEFAULT_EVENT_SLUG
  const tasks = [
    api(`/events/${encodeURIComponent(slug)}`)
      .then(({ data }) => {
        useBrandStore.getState().setBrand({ theme: data?.theme, logoUrl: data?.logo_url })
        applyTheme(useBrandStore.getState().theme)
      })
      .catch(() => {}),
  ]
  if (token) {
    tasks.push(
      api('/auth/me')
        .then(({ data }) => useSessionStore.getState().setSession(data))
        .catch(() => {}),
    )
  }
  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistration('/app').then((registration) => checkForAppUpdate(registration)).catch(() => {}),
    )
  }
  await Promise.allSettled(tasks)
}

/**
 * Pull-down gesture on the app scroll container. Refreshes remote data, session,
 * brand and checks for a newer PWA build. Renders the status indicator at the top.
 */
export default function PullToRefresh({ scrollRef }) {
  const refreshing = useRefreshStore((state) => state.refreshing)
  const begin = useRefreshStore((state) => state.begin)
  const end = useRefreshStore((state) => state.end)
  const [pull, setPull] = useState(0)
  const [armed, setArmed] = useState(false)
  const gesture = useRef(null)
  const pullRef = useRef(0)

  const runRefresh = useCallback(async () => {
    if (!begin()) return
    setArmed(false)
    setPull(THRESHOLD * 0.85)
    pullRef.current = THRESHOLD * 0.85
    try {
      if (navigator.vibrate) navigator.vibrate(12)
      await Promise.all([refreshSessionAndBrand(), sleep(MIN_SPIN_MS)])
    } finally {
      end()
      setPull(0)
      pullRef.current = 0
    }
  }, [begin, end])

  useEffect(() => {
    const scroller = scrollRef?.current
    if (!scroller) return undefined

    const clearGesture = () => {
      gesture.current = null
    }

    const onPointerDown = (event) => {
      if (refreshing) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (scroller.scrollTop > 1) return
      // Ignore pulls that start on form fields or horizontal chip strips.
      const target = event.target
      if (target?.closest?.('input, textarea, select, [data-no-ptr]')) return
      gesture.current = {
        id: event.pointerId,
        startY: event.clientY,
        startX: event.clientX,
        pulling: false,
      }
    }

    const onPointerMove = (event) => {
      const g = gesture.current
      if (!g || g.id !== event.pointerId || refreshing) return
      if (scroller.scrollTop > 1) {
        if (g.pulling) {
          setPull(0)
          pullRef.current = 0
          setArmed(false)
        }
        clearGesture()
        return
      }

      const dy = event.clientY - g.startY
      const dx = Math.abs(event.clientX - g.startX)
      if (!g.pulling) {
        if (dy < 8) return
        if (dx > dy) {
          clearGesture()
          return
        }
        g.pulling = true
        try {
          scroller.setPointerCapture?.(event.pointerId)
        } catch {
          /* ignore */
        }
      }

      if (dy <= 0) {
        setPull(0)
        pullRef.current = 0
        setArmed(false)
        return
      }

      event.preventDefault()
      const next = resistance(dy)
      pullRef.current = next
      setPull(next)
      setArmed(next >= THRESHOLD)
    }

    const finish = (event) => {
      const g = gesture.current
      if (!g || (event && g.id !== event.pointerId)) return
      const shouldRefresh = g.pulling && pullRef.current >= THRESHOLD && !refreshing
      clearGesture()
      if (shouldRefresh) {
        runRefresh()
        return
      }
      setArmed(false)
      setPull(0)
      pullRef.current = 0
    }

    scroller.addEventListener('pointerdown', onPointerDown, { passive: true })
    scroller.addEventListener('pointermove', onPointerMove, { passive: false })
    scroller.addEventListener('pointerup', finish)
    scroller.addEventListener('pointercancel', finish)
    scroller.addEventListener('lostpointercapture', finish)

    return () => {
      scroller.removeEventListener('pointerdown', onPointerDown)
      scroller.removeEventListener('pointermove', onPointerMove)
      scroller.removeEventListener('pointerup', finish)
      scroller.removeEventListener('pointercancel', finish)
      scroller.removeEventListener('lostpointercapture', finish)
    }
  }, [scrollRef, refreshing, runRefresh])

  const progress = Math.min(1, pull / THRESHOLD)
  const visible = pull > 2 || refreshing
  const spinning = refreshing
  const label = refreshing ? 'Refreshing…' : armed ? 'Release to refresh' : 'Pull to refresh'

  return (
    <div
      className={`ptr ${visible ? 'ptr-on' : ''} ${spinning ? 'ptr-spin' : ''} ${armed ? 'ptr-armed' : ''}`}
      style={{ '--ptr-pull': `${pull}px`, '--ptr-progress': String(progress) }}
      aria-hidden={!visible}
    >
      <div className="ptr-slot" style={{ height: visible ? Math.max(pull, spinning ? 56 : 0) : 0 }}>
        <div className="ptr-pill">
          <span className="ptr-ring" aria-hidden="true">
            <svg viewBox="0 0 40 40" className="ptr-svg">
              <circle className="ptr-track" cx="20" cy="20" r="14" fill="none" strokeWidth="3" />
              <circle
                className="ptr-arc"
                cx="20"
                cy="20"
                r="14"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(progress * 72).toFixed(1)} 88`}
              />
            </svg>
          </span>
          <span className="ptr-label">{label}</span>
        </div>
      </div>
    </div>
  )
}
