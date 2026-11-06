import { useEffect, useRef } from 'react'
import { useRefreshStore } from '../store/refreshStore'

/**
 * Runs `onRefresh` whenever the user pulls to refresh (skips the first mount).
 * Use on screens that load data outside `useRemote`.
 */
export function useRefreshListener(onRefresh) {
  const epoch = useRefreshStore((state) => state.epoch)
  const callback = useRef(onRefresh)
  callback.current = onRefresh
  const skip = useRef(true)

  useEffect(() => {
    if (skip.current) {
      skip.current = false
      return
    }
    callback.current?.()
  }, [epoch])
}
