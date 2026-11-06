import { useSessionStore } from '../store/sessionStore'

// Same origin as the app by default (the Laravel API serves /api/mobile/v1 beside /app).
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/mobile/v1').replace(/\/$/, '')
export const DEFAULT_EVENT_SLUG = import.meta.env.VITE_EVENT_SLUG ?? 'cphia-2026'

const UNAVAILABLE = 'The server is busy or briefly unavailable. Please try again in a moment.'

/** A plain-language message for a failed request, used when the server did not send its own. */
function friendlyMessage(status) {
  if (status === 0) return 'Could not reach the server. Check your connection and try again.'
  if (status === 429) return 'Too many attempts. Wait a moment and try again.'
  if (status === 401) return 'Your session has ended. Sign in again to continue.'
  if (status === 403) return 'You do not have access to this.'
  if (status === 404) return 'This could not be found. It may have been removed.'
  if (status === 502 || status === 503 || status === 504) return UNAVAILABLE
  if (status >= 500) return 'Something went wrong on our side. Please try again.'
  return 'This request could not be completed. Please try again.'
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? friendlyMessage(status))
    this.status = status
    this.body = body
    this.fieldErrors = body?.errors ?? {}
  }
}

/** Calls the CPHIA mobile API with the signed-in user's bearer token. A FormData body is sent as multipart. */
export async function api(path, { method = 'GET', body, signal } = {}) {
  const token = useSessionStore.getState().token
  const isForm = body instanceof FormData
  const headers = { Accept: 'application/json' }
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    // A dropped connection surfaces as a TypeError. Aborts pass through so callers can ignore them.
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, null)
  }
  // Gateway errors arrive as an HTML page, so a body that is not JSON becomes null here.
  const data = await response.json().catch(() => null)

  if (response.status === 401 && token) {
    useSessionStore.getState().signOut()
  }
  if (!response.ok) throw new ApiError(response.status, data)
  return data
}

/** API lists come as {data: [...]} or {data: {items: [...]}}. */
export function listOf(payload) {
  const data = payload?.data ?? payload
  if (Array.isArray(data)) return data
  return Array.isArray(data?.items) ? data.items : []
}

export function firstFieldError(error, field) {
  return error instanceof ApiError ? error.fieldErrors[field]?.[0] ?? null : null
}
