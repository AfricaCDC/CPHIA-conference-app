/** Offline-first helpers for staff badge / parking scans. */

const DB_NAME = 'cphia-staff-offline'
const DB_VERSION = 1
const SCANS = 'scans'
const QUEUE = 'queue'
const MAX_SCANS = 400

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SCANS)) {
        db.createObjectStore(SCANS, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(QUEUE)) {
        db.createObjectStore(QUEUE, { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open offline store'))
  })
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(storeName, mode, work) {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const store = tx.objectStore(storeName)
      let result
      Promise.resolve()
        .then(() => work(store))
        .then((value) => {
          result = value
        })
        .catch(reject)
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error ?? new Error('Offline store transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('Offline store transaction aborted'))
    })
  } catch {
    return null
  }
}

/** Stable cache keys from a raw QR / typed code. */
export function scanKeys(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return []
  const keys = [value.toLowerCase()]
  try {
    const decoded = JSON.parse(value)
    if (decoded && typeof decoded === 'object') {
      for (const field of ['t', 'token', 'receipt_token', 'public_id', 'registration_public_id', 'ref']) {
        const part = decoded[field]
        if (part != null && String(part).trim() !== '') keys.push(String(part).trim().toLowerCase())
      }
    }
  } catch {
    /* plain token */
  }
  return [...new Set(keys)]
}

export async function rememberScan(eventSlug, raw, person, kind = 'badge') {
  if (!person || typeof person !== 'object') return
  const keys = scanKeys(raw)
  if (keys.length === 0) return
  const savedAt = Date.now()
  await withStore(SCANS, 'readwrite', (store) => {
    for (const keyPart of keys) {
      store.put({
        key: `${String(eventSlug).toLowerCase()}::${keyPart}`,
        eventSlug,
        kind,
        person,
        savedAt,
      })
    }
  })
  await trimScans()
  warmPhoto(person.photo_url)
}

async function trimScans() {
  await withStore(SCANS, 'readwrite', async (store) => {
    const all = (await requestToPromise(store.getAll())) ?? []
    if (all.length <= MAX_SCANS) return
    all
      .sort((a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0))
      .slice(0, all.length - MAX_SCANS)
      .forEach((row) => store.delete(row.key))
  })
}

export async function lookupScan(eventSlug, raw) {
  const keys = scanKeys(raw)
  for (const keyPart of keys) {
    const row = await withStore(SCANS, 'readonly', (store) =>
      requestToPromise(store.get(`${String(eventSlug).toLowerCase()}::${keyPart}`)),
    )
    if (row?.person) return { ...row.person, offline_cached: true, offline_kind: row.kind }
  }
  return null
}

export async function enqueueStaffAction(action) {
  await withStore(QUEUE, 'readwrite', (store) => {
    store.add({ ...action, queued_at: Date.now() })
  })
  try {
    const reg = await navigator.serviceWorker?.ready
    await reg?.sync?.register?.('sync-staff-actions')
  } catch {
    /* Background Sync is optional */
  }
}

export async function pendingStaffActions() {
  return (await withStore(QUEUE, 'readonly', (store) => requestToPromise(store.getAll()))) ?? []
}

export async function flushStaffQueue(apiFn) {
  const rows = await pendingStaffActions()
  if (!rows.length) return { flushed: 0 }
  let flushed = 0
  for (const row of rows) {
    try {
      await apiFn(row.path, { method: row.method ?? 'POST', body: row.body })
      await withStore(QUEUE, 'readwrite', (store) => {
        store.delete(row.id)
      })
      flushed += 1
    } catch {
      break
    }
  }
  return { flushed }
}

/** Ask the service worker image cache to keep a face on device. */
export function warmPhoto(url) {
  if (!url || typeof url !== 'string') return
  fetch(url, { mode: 'no-cors', credentials: 'omit' }).catch(() => {})
}

export function isProbablyOfflineError(error) {
  return error?.status === 0 || error?.name === 'TypeError' || !navigator.onLine
}
