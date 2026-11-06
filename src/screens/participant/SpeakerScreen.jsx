import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { LoadState } from '../../components/ui/LoadState'
import { initials } from '../../components/ui/Avatar'
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
  const photo = speaker.photo_large_url ?? speaker.photo_url ?? speaker.external_photo_url
  const details = [speaker.title, speaker.organization].filter(Boolean).join(' · ')

  return (
    <>
      <div className="h-[52dvh] w-full overflow-hidden bg-mint-soft">
        {photo ? (
          <img src={photo} alt="" className="size-full object-cover object-[50%_20%]" />
        ) : (
          <span className="grid size-full place-items-center text-5xl font-black text-teal-dark">{initials(speaker.name)}</span>
        )}
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
