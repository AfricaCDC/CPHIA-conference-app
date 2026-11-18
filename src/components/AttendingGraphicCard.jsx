import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import Button from './ui/Button'
import Card, { CardTitle } from './ui/Card'
import { useAppStore } from '../store/appStore'

const CANVAS_W = 1890
const CANVAS_H = 2362
const BOX = { x: 1073, y: 1073, w: 608, h: 753 }
const TX = 224
const TTOP = 1500
const TMAX = 820
const NAME = { size: 56, min: 34, lh: 1.14, weight: '700' }
const AFFIL = { size: 46, min: 26, lh: 1.2, weight: '400', gap: 12 }
const FONT = 'Arial, Helvetica, sans-serif'
const FILENAME = 'CPHIA2026-I-will-be-attending.png'
const TEMPLATE_SRC = `${import.meta.env.BASE_URL}images/cphia-attending-template.jpg`

function wrapText(ctx, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function layoutText(ctx, spec, text) {
  let size = spec.size
  for (; size > spec.min; size -= 1) {
    ctx.font = `${spec.weight} ${size}px ${FONT}`
    const longest = text
      .split(/\s+/)
      .filter(Boolean)
      .reduce((max, word) => Math.max(max, ctx.measureText(word).width), 0)
    if (longest <= TMAX) break
  }
  ctx.font = `${spec.weight} ${size}px ${FONT}`
  return { size, lines: wrapText(ctx, text, TMAX), lh: size * spec.lh }
}

function drawBlock(ctx, spec, text, topY) {
  if (!text.trim()) return topY
  const laid = layoutText(ctx, spec, text)
  ctx.font = `${spec.weight} ${laid.size}px ${FONT}`
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  let y = topY
  for (const line of laid.lines) {
    ctx.fillText(line, TX, y)
    y += laid.lh
  }
  return y
}

function canvasBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/**
 * “I will be Attending” share graphic for the phone app.
 * Prefills from the app profile photo (users.avatar) when set; otherwise shows the Admin
 * registration photo for convenience. Choosing a photo here stays on-device and never
 * writes to Admin / badge storage.
 */
export default function AttendingGraphicCard({ name = '', organization = '', photoUrl = null }) {
  const showToast = useAppStore((state) => state.showToast)
  const canvasRef = useRef(null)
  const templateRef = useRef(null)
  const photoRef = useRef(null)
  const viewRef = useRef({ scale: 1, offX: 0, offY: 0 })
  const replacedRef = useRef(false)
  const dragRef = useRef(null)

  const [displayName, setDisplayName] = useState(String(name || '').slice(0, 42))
  const [affiliation, setAffiliation] = useState(String(organization || '').slice(0, 60))
  const [zoom, setZoom] = useState(100)
  const [hasPhoto, setHasPhoto] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [templateReady, setTemplateReady] = useState(false)
  const [busy, setBusy] = useState(null)
  const [fileLabel, setFileLabel] = useState(
    photoUrl ? 'Using your current profile photo' : 'JPEG or PNG · portrait works best',
  )

  useEffect(() => {
    setDisplayName(String(name || '').slice(0, 42))
  }, [name])

  useEffect(() => {
    setAffiliation(String(organization || '').slice(0, 60))
  }, [organization])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    const template = templateRef.current
    if (template?.complete && template.naturalWidth) {
      ctx.drawImage(template, 0, 0, CANVAS_W, CANVAS_H)
    }
    const photo = photoRef.current
    if (photo?.complete && photo.naturalWidth) {
      const base = Math.max(BOX.w / photo.width, BOX.h / photo.height)
      const view = viewRef.current
      const scale = base * view.scale
      const dw = photo.width * scale
      const dh = photo.height * scale
      const mx = Math.max(0, (dw - BOX.w) / 2)
      const my = Math.max(0, (dh - BOX.h) / 2)
      view.offX = Math.max(-mx, Math.min(mx, view.offX))
      view.offY = Math.max(-my, Math.min(my, view.offY))
      ctx.save()
      ctx.beginPath()
      ctx.rect(BOX.x, BOX.y, BOX.w, BOX.h)
      ctx.clip()
      ctx.drawImage(
        photo,
        BOX.x + (BOX.w - dw) / 2 + view.offX,
        BOX.y + (BOX.h - dh) / 2 + view.offY,
        dw,
        dh,
      )
      ctx.restore()
    }
    const nameHasText = displayName.trim().length > 0
    const bottom = drawBlock(ctx, NAME, displayName, TTOP)
    drawBlock(ctx, AFFIL, affiliation, nameHasText ? bottom + AFFIL.gap : TTOP)
  }, [affiliation, displayName])

  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      templateRef.current = image
      setTemplateReady(true)
    }
    image.src = TEMPLATE_SRC
    return () => { image.onload = null }
  }, [])

  useEffect(() => {
    paint()
  }, [paint, hasPhoto, zoom, templateReady, dragging])

  // Prefill from the signed-in user's current photo_url (app avatar preferred by the API).
  useEffect(() => {
    if (replacedRef.current || !photoUrl) return undefined
    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (cancelled || replacedRef.current) return
      photoRef.current = image
      viewRef.current = { scale: 1, offX: 0, offY: 0 }
      setZoom(100)
      setHasPhoto(true)
      setFileLabel('Using your current profile photo')
    }
    image.onerror = () => {
      if (!cancelled) setFileLabel('Could not load profile photo — choose one below')
    }
    // Bust cache when the app avatar changes so the canvas refreshes.
    image.src = photoUrl.includes('?') ? `${photoUrl}&t=${Date.now()}` : `${photoUrl}?t=${Date.now()}`
    return () => { cancelled = true }
  }, [photoUrl])

  function loadFile(file) {
    if (!file || !/^image\/(png|jpeg)/.test(file.type)) {
      showToast('Choose a JPEG or PNG photo', 'info')
      return
    }
    replacedRef.current = true
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        photoRef.current = image
        viewRef.current = { scale: 1, offX: 0, offY: 0 }
        setZoom(100)
        setHasPhoto(true)
        setFileLabel(`${file.name} · stays on this device only`)
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function pointerScale() {
    const canvas = canvasRef.current
    if (!canvas) return 1
    const width = canvas.getBoundingClientRect().width
    return width > 0 ? CANVAS_W / width : 1
  }

  function onPointerDown(event) {
    if (!photoRef.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY }
    setDragging(true)
  }

  function onPointerMove(event) {
    const last = dragRef.current
    if (!last) return
    const k = pointerScale()
    viewRef.current.offX += (event.clientX - last.x) * k
    viewRef.current.offY += (event.clientY - last.y) * k
    dragRef.current = { x: event.clientX, y: event.clientY }
    paint()
  }

  function onPointerUp() {
    dragRef.current = null
    setDragging(false)
  }

  async function download() {
    paint()
    setBusy('download')
    try {
      const blob = await canvasBlob(canvasRef.current)
      if (!blob) throw new Error('Could not create the image')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = FILENAME
      link.href = url
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast('Graphic downloaded')
    } catch (err) {
      showToast(err.message || 'Download failed', 'info')
    } finally {
      setBusy(null)
    }
  }

  async function share() {
    paint()
    setBusy('share')
    try {
      const blob = await canvasBlob(canvasRef.current)
      if (!blob) throw new Error('Could not create the image')
      const file = new File([blob], FILENAME, { type: 'image/png' })
      const text = 'I will be attending CPHIA 2026 in Addis Ababa. #AfricaReady #CPHIA2026'
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: 'I will be Attending · CPHIA 2026',
          text,
          files: [file],
        })
        showToast('Shared')
        return
      }
      if (navigator.share) {
        await navigator.share({ title: 'I will be Attending · CPHIA 2026', text })
        showToast('Shared')
        return
      }
      await navigator.clipboard?.writeText?.(`${text}\nhttps://cphia.africacdc.org/register`)
      showToast('Hashtags copied — download the image to post it', 'info')
    } catch (err) {
      if (err?.name === 'AbortError') return
      showToast(err.message || 'Share failed', 'info')
    } finally {
      setBusy(null)
    }
  }

  const canExport = hasPhoto || displayName.trim().length > 0

  return (
    <Card>
      <CardTitle>I will be Attending</CardTitle>
      <p className="s mb-3">
        Create your share graphic. Your app profile photo is used when you have one — it does not change the Admin photo used for badges.
        Share with <strong>#AfricaReady</strong> and <strong>#CPHIA2026</strong>.
      </p>

      <div className="relative mb-3 overflow-hidden rounded-xl bg-ink">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          aria-label="Live preview of your I will be Attending graphic"
          className={`block h-auto w-full ${hasPhoto ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {hasPhoto && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">
            Drag photo to reposition
          </p>
        )}
      </div>

      <div className="mb-3 space-y-2">
        <label className="block text-sm font-semibold">Photo on the graphic</label>
        <label className="btn sm inline-flex cursor-pointer">
          {hasPhoto ? 'Choose a different photo' : 'Choose photo'}
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            onChange={(event) => {
              loadFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        <p className="s">{fileLabel}</p>
        {hasPhoto && (
          <label className="block text-xs font-semibold text-subtle">
            Zoom
            <input
              type="range"
              min={100}
              max={300}
              value={zoom}
              className="mt-1 w-full"
              onChange={(event) => {
                const next = Number(event.target.value)
                viewRef.current.scale = next / 100
                setZoom(next)
              }}
            />
          </label>
        )}
      </div>

      <div className="mb-3 space-y-2">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Name on the graphic</span>
          <input
            value={displayName}
            maxLength={42}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Affiliation on the graphic</span>
          <input
            value={affiliation}
            maxLength={60}
            onChange={(e) => setAffiliation(e.target.value)}
            placeholder="Organisation"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <Button icon={Download} className="w-full" disabled={!canExport || busy} onClick={download}>
          {busy === 'download' ? 'Preparing…' : 'Download image'}
        </Button>
        <Button icon={Share2} variant="secondary" className="w-full" disabled={!canExport || busy} onClick={share}>
          {busy === 'share' ? 'Preparing…' : 'Share'}
        </Button>
        <p className="s">The graphic stays on this device. Choosing a photo here does not update Admin or your badge.</p>
      </div>
    </Card>
  )
}
