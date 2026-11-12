import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { LoadState } from '../../components/ui/LoadState'
import { useEffect, useState } from 'react'
import { initials } from '../../components/ui/Avatar'
import { speakerPhotoCandidates } from '../../lib/speakerPhotos'
import { useRemote } from '../../lib/useRemote'
import { useEventSlug } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

/**
 * One speaker's full page: photo, role and bio. Opened from the speakers grid with the speaker already
 * loaded; after a reload it loads the speaker by id.
 */
export default function SpeakerScreen({ params }) {
  const slug = useEventSlug()
  const navigateTo = useAppStore((state) => state.navigateTo)
  const id = params?.id ?? params?.speaker?.id
  const remote = useRemote(!params?.speaker && id ? `/events/${encodeURIComponent(slug)}/speakers/${id}` : null)
  const speaker = params?.speaker ?? remote.data?.data

  if (!speaker && !id) {
    // Reached with nothing to show: go back to the list.
    navigateTo('speakers')
    return null
  }

  return (
    <>
      <ScreenHeader kicker="Speaker" title={speaker?.name ?? ''} back />
      <Body className="p-0">
        <LoadState loading={!speaker && remote.loading} error={!speaker ? remote.error : null} onRetry={remote.reload}>
          {speaker && <SpeakerDetails speaker={speaker} />}
        </LoadState>
      </Body>
    </>
  )
}

function SpeakerDetails({ speaker }) {
  const photos = speakerPhotoCandidates(speaker, { large: true })
  const [candidate, setCandidate] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const photo = photos[candidate]
  const details = [speaker.title, speaker.organization].filter(Boolean).join(' · ')

  useEffect(() => {
    setCandidate(0)
    setLoaded(false)
  }, [speaker.id])

  return (
    <>
      <div className="relative h-[52dvh] w-full overflow-hidden bg-mint-soft">
        {photo ? (
          <img
            key={photo}
            src={photo}
            alt=""
            onLoad={() => setLoaded(true)}
            onError={() => setCandidate((index) => index + 1)}
            className={`size-full object-cover object-[50%_20%] ${loaded ? '' : 'opacity-0'}`}
          />
        ) : null}
        {!photo || !loaded ? (
          <span className="absolute inset-0 grid place-items-center px-16">
            {photo ? (
              <span className="photo-refresh-track w-full max-w-xs" role="progressbar" aria-label="Updating photo">
                <span className="photo-refresh-bar animate-pulse" style={{ width: '40%' }} />
              </span>
            ) : (
              <span className="text-5xl font-black text-teal-dark">{initials(speaker.name)}</span>
            )}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 px-5 pb-6 pt-4">
        {speaker.is_keynote && <span className="self-start rounded-full bg-sun px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-ink">Keynote</span>}
        <h2 className="text-xl font-black leading-tight">{speaker.name}</h2>
        {details && <p className="text-sm text-muted">{details}</p>}
        {speaker.bio && <p className="whitespace-pre-line pt-2 text-[15px] leading-relaxed">{speaker.bio}</p>}
      </div>
    </>
  )
}
