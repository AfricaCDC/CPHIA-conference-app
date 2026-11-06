import Card from './ui/Card'
import { useEffect, useLayoutEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useSessionStore } from '../store/sessionStore'

// Each step points at an element marked data-tour="…" on Home. A step without a target shows centred.
const STEPS = [
  { title: 'Welcome to CPHIA 2026', body: 'A one-minute tour of your conference app. Replay it any time from More → Take the quick tour.' },
  { target: 'badge-card', title: 'Your badge', body: 'Tap to show your badge QR at the desk. It also shows where to collect your printed badge and the box it is packed in.' },
  { target: 'needs', title: 'Needs you now', body: 'What is waiting for you: confirm your ticket and hotel, add visa details, upload DSA documents, read new updates.' },
  { target: 'tab-programme', title: 'Programme', body: 'Sessions and side events by day. Tap + to build your own schedule, and open a session for its room and speakers.' },
  { target: 'tab-transport', title: 'Transport', body: 'Shuttle routes and your rides. At a stop with no bus? Pick your route and stop and send “I am waiting”.' },
  { target: 'tab-connect', title: 'Connect', body: 'Find delegates, connect and message them. Show your card QR to swap contacts in person.' },
  { target: 'messages', title: 'Messages', body: 'Chats with delegates, every update from the desks (ticket, hotel, badge, transport) and a chat with the Travel & Finance desks. DSA, bank details and payments are under Finance on Home.' },
  { target: 'announcements', title: 'Announcements', body: 'News from the organisers: shuttle changes, room changes and reminders.' },
  { target: 'profile', title: 'Your profile', body: 'Add your photo and a short bio, and choose whether other delegates can find you.' },
  { target: 'tab-more', title: 'More', body: 'Every section, settings and notifications. Turn notifications on so you never miss an update.' },
]
const PADDING = 6

/** An element's box relative to the phone frame's padding edge (the box absolute children use). */
function rectInFrame(element) {
  const frame = document.querySelector('.phone-frame')
  const box = element.getBoundingClientRect()
  if (!frame) return box
  const frameBox = frame.getBoundingClientRect()
  return {
    top: box.top - frameBox.top - frame.clientTop,
    left: box.left - frameBox.left - frame.clientLeft,
    width: box.width,
    height: box.height,
  }
}

function useTargetRect(target) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    if (!target) return setRect(null)
    const element = document.querySelector(`[data-tour="${target}"]`)
    element?.scrollIntoView({ block: 'nearest' })
    // Measured against the phone frame, because the overlay is positioned inside it.
    const update = () => setRect(element ? rectInFrame(element) : null)
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [target])
  return rect
}

/**
 * First-run walkthrough for delegates. It opens the first time the app is used; "Skip" closes it
 * until the app is opened again, "Don't show again" (or finishing it) hides it for good.
 */
export default function QuickTour() {
  const userId = useSessionStore((state) => state.user?.id ?? 'anonymous')
  const seen = useAppStore((state) => state.toursSeen.includes(userId))
  const skipped = useAppStore((state) => state.tourSkipped)
  const screen = useAppStore((state) => state.screen)
  const open = useAppStore((state) => state.tourOpen)
  const setOpen = useAppStore((state) => state.setTourOpen)
  const skipTour = useAppStore((state) => state.skipTour)
  const switchTab = useAppStore((state) => state.switchTab)
  const markSeen = useAppStore((state) => state.markTourSeen)
  const [index, setIndex] = useState(0)
  const [steps, setSteps] = useState(STEPS)
  const [dontShow, setDontShow] = useState(false)
  const step = steps[Math.min(index, steps.length - 1)]
  const rect = useTargetRect(open ? step?.target : null)

  useEffect(() => {
    if (!seen && !skipped && screen === 'home') setOpen(true)
  }, [seen, skipped, screen, setOpen])

  // The tour points at Home; once it is on screen, drop steps whose target is not there.
  useLayoutEffect(() => {
    if (!open) return
    if (screen !== 'home') switchTab('home')
    setIndex(0)
    const timer = setTimeout(() => setSteps(STEPS.filter((s) => !s.target || document.querySelector(`[data-tour="${s.target}"]`))), 250)
    return () => clearTimeout(timer)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && skip()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function skip() {
    if (dontShow) markSeen(userId)
    skipTour()
  }

  function finish() {
    markSeen(userId)
    setOpen(false)
  }

  if (!open || !step) return null
  const isLast = index >= steps.length - 1
  const frameHeight = document.querySelector('.phone-frame')?.clientHeight ?? window.innerHeight
  const cardAtTop = rect ? rect.top > frameHeight / 2 : false

  return (
    <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-4 ring-sun transition-all duration-300"
          style={{ top: rect.top - PADDING, left: rect.left - PADDING, width: rect.width + PADDING * 2, height: rect.height + PADDING * 2, boxShadow: '0 0 0 9999px rgba(18, 48, 43, 0.75)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(18,48,43,0.75)]" />
      )}
      <div className={`absolute inset-x-0 mx-auto max-w-xl px-4 ${rect ? (cardAtTop ? 'top-6' : 'bottom-28') : 'top-1/4'}`}>
        <Card className="card gap-3 p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <p className="lab">Step {index + 1} of {steps.length}</p>
            <button type="button" onClick={skip} className="text-xs font-extrabold text-maroon underline">Skip</button>
          </div>
          <h2 id="tour-title" className="text-xl font-black">{step.title}</h2>
          <p id="tour-body" className="s text-sm">{step.body}</p>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button type="button" className="btn o sm" onClick={() => setIndex(index - 1)} aria-label="Previous step"><ArrowLeft size={16} aria-hidden="true" /></button>
            )}
            <div className="flex flex-1 justify-center gap-1.5" aria-hidden="true">
              {steps.map((s, i) => <span key={s.title} className={`size-2 rounded-full ${i === index ? 'bg-ink' : 'bg-line'}`} />)}
            </div>
            <button type="button" className="btn y sm" onClick={isLast ? finish : () => setIndex(index + 1)}>
              {isLast ? 'Start exploring' : <>Next <ArrowRight size={16} aria-hidden="true" /></>}
            </button>
          </div>
          {!isLast && (
            <label className="flex items-center gap-2 text-xs font-semibold text-muted">
              <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="size-4 accent-ink" />
              Don’t show this tour again
            </label>
          )}
        </Card>
      </div>
    </div>
  )
}
