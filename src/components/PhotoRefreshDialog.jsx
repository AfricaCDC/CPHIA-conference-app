import { useEffect } from 'react'
import { useEventSlug } from '../lib/useParticipant'
import { refreshSpeakerPhotos } from '../lib/speakerPhotos'
import { usePhotoRefreshStore } from '../store/photoRefreshStore'

/** Shown while speaker portraits are downloading after the app opens. */
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
    <div className="photo-refresh" role="dialog" aria-modal="false" aria-labelledby="photo-refresh-title">
      <div className="flex items-baseline justify-between gap-3">
        <p id="photo-refresh-title" className="m-0 text-sm font-extrabold">Updating photos</p>
        <p className="m-0 text-xs font-bold text-muted">{Math.min(done, total)} of {total}</p>
      </div>
      <div className="photo-refresh-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Photo update progress">
        <span className="photo-refresh-bar" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
