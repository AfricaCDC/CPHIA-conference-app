import { create } from 'zustand'
import { API_BASE_URL, mobileApiHeaders } from './api'
import { useSessionStore } from '../store/sessionStore'

/** In-app document overlay (PDFs and images), so files stay inside the PWA shell. */
export const useDocumentViewerStore = create((set, get) => ({
  doc: null,
  open: (doc) => {
    const previous = get().doc
    if (previous?.revokeOnClose && previous.url?.startsWith('blob:')) {
      URL.revokeObjectURL(previous.url)
    }
    set({ doc })
  },
  close: () => {
    const current = get().doc
    if (current?.revokeOnClose && current.url?.startsWith('blob:')) {
      URL.revokeObjectURL(current.url)
    }
    set({ doc: null })
  },
}))

function guessKind(mime, path = '') {
  const type = String(mime || '').toLowerCase()
  const lowerPath = String(path || '').toLowerCase()
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(lowerPath)) return 'image'
  if (type.includes('pdf') || /\.pdf(\?|$)/i.test(lowerPath) || /\/pdf(\?|$)/i.test(lowerPath)) return 'pdf'
  return 'other'
}

function fileNameFromPath(path) {
  try {
    const clean = String(path || '').split('?')[0]
    const part = clean.split('/').filter(Boolean).pop() || 'Document'
    return decodeURIComponent(part)
  } catch {
    return 'Document'
  }
}

/**
 * Opens a protected file (e-ticket, letter, receipt) with the bearer token inside the app.
 * Takes an API path or a full /api/… path.
 */
export async function openProtectedFile(path, { title } = {}) {
  const token = useSessionStore.getState().token
  const url = path.startsWith('/api/')
    ? `${new URL(API_BASE_URL, window.location.origin).origin}${path}`
    : `${API_BASE_URL}${path}`
  const headers = mobileApiHeaders()
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error('The file could not be opened.')
  const blob = await response.blob()
  const mime = blob.type || response.headers.get('content-type') || ''
  const blobUrl = URL.createObjectURL(blob)
  useDocumentViewerStore.getState().open({
    url: blobUrl,
    title: title || fileNameFromPath(path),
    kind: guessKind(mime, path),
    mime,
    revokeOnClose: true,
  })
}

/** Opens a public URL (floor plan PDF/image) inside the app viewer. */
export function openInAppDocument(url, { title, kind, mime } = {}) {
  if (!url) throw new Error('The file could not be opened.')
  useDocumentViewerStore.getState().open({
    url,
    title: title || fileNameFromPath(url),
    kind: kind || guessKind(mime, url),
    mime: mime || '',
    revokeOnClose: false,
  })
}
