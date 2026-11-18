import { useEffect } from 'react'
import { useEventSlug } from '../lib/useParticipant'
import { refreshSpeakerPhotos } from '../lib/speakerPhotos'
import { usePhotoRefreshStore } from '../store/photoRefreshStore'

/**
 * Starts speaker-portrait caching in the background on each app open.
 * Progress stays silent — no toast/loader for users.
 */
export default function PhotoRefreshDialog() {
  const slug = useEventSlug()

  useEffect(() => {
    refreshSpeakerPhotos(slug).catch(() => usePhotoRefreshStore.getState().finish())
  }, [slug])

  return null
}
