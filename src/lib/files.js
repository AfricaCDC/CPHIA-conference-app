import { API_BASE_URL } from './api'
import { useSessionStore } from '../store/sessionStore'

/** Opens a protected file (e-ticket, letter) with the bearer token, in a new tab. Takes an API path or a full /api/… path. */
export async function openProtectedFile(path) {
  const token = useSessionStore.getState().token
  const url = path.startsWith('/api/') ? `${new URL(API_BASE_URL, window.location.origin).origin}${path}` : `${API_BASE_URL}${path}`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('The file could not be opened.')
  const blobUrl = URL.createObjectURL(await response.blob())
  window.open(blobUrl, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
}
