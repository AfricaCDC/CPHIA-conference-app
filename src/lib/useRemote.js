import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { useRefreshStore } from '../store/refreshStore'

/** GETs an API path and keeps {data, error, loading}; reload() refetches. A null path skips the request. */
export function useRemote(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) })
  const [version, setVersion] = useState(0)
  const refreshEpoch = useRefreshStore((store) => store.epoch)

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false })
      return undefined
    }
    const controller = new AbortController()
    setState((previous) => ({ ...previous, loading: true }))
    api(path, { signal: controller.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, error, loading: false })
      })
    return () => controller.abort()
  }, [path, version, refreshEpoch])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return { ...state, reload }
}
