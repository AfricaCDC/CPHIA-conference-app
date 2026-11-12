import { useEffect } from 'react'
import { useEventSlug } from '../lib/useParticipant'
import { refreshSpeakerPhotos } from '../lib/speakerPhotos'
import { usePhotoRefreshStore } from '../store/photoRefreshStore'

/** A status line while portraits download. It does not take taps, so the rest of the app stays usable. */
export default function PhotoRefreshDialog() {
  const slug = useEventSlug()
  const active = usePhotoRefreshStore((state) => state.active)
  const done = usePhotoRefreshStore((state) => state.done)
  const total = usePhotoRefreshStore((state) => state.total)

  useEffect(() => {
    refreshSpeakerPhotos(slug).catch(() => usePhotoRefreshStore.getState().finish())
  }, [slug])

  if (!active || total < 1) return null
  const percent = Math.round((Math.min(done, total) / total) * 100)

  return (
    <div className="photo-refresh" role="status" aria-live="polite">
      <p className="m-0 text-xs font-extrabold">Updating photos · {Math.min(done, total)} of {total}</p>
      <div className="photo-refresh-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Photo update progress">
        <span className="photo-refresh-bar" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
