import { useState } from 'react'
import { BookmarkCheck, BookmarkPlus, Linkedin, MessageCircle } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardTitle } from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { api } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

/** Opens (or creates) the 1:1 conversation with a delegate and goes to the chat. */
export async function startChat(slug, person, navigateTo) {
  const { data } = await api(`/events/${encodeURIComponent(slug)}/conversations`, {
    method: 'POST',
    body: { recipient_user_id: person.user_id },
  })
  navigateTo('chat', { id: data.id, name: person.name, photo: person.photo_url ?? null })
}

export default function AttendeeScreen({ params }) {
  const slug = useEventSlug()
  const navigateTo = useAppStore((state) => state.navigateTo)
  const showToast = useAppStore((state) => state.showToast)
  const { data, loading, error, reload } = useRemote(`/events/${encodeURIComponent(slug)}/attendees/${encodeURIComponent(params.publicId)}`)
  const [busy, setBusy] = useState(null)
  const person = data?.data

  async function run(kind, action) {
    setBusy(kind)
    try {
      await action()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(null)
    }
  }

  const saveContact = () =>
    run('save', async () => {
      await api(`/events/${encodeURIComponent(slug)}/connections`, { method: 'POST', body: { registration_public_id: person.public_id } })
      showToast(`${person.name} saved to your contacts`)
      reload()
    })

  return (
    <>
      <ScreenHeader kicker="Delegate" title={person?.name ?? 'Delegate'} back />
      <Body>
        <LoadState loading={loading} error={error} onRetry={reload}>
          {person && (
            <>
              <Card className="items-center text-center">
                <Avatar name={person.name} photoUrl={person.photo_url} size="xl" />
                <h2 className="text-xl font-black">{person.name}</h2>
                {person.networking_headline && <p className="text-sm font-bold text-teal-dark">{person.networking_headline}</p>}
                <p className="text-subtle text-sm">{[person.job_title, person.organization].filter(Boolean).join(' · ')}</p>
                {person.sector && <Badge>{person.sector}</Badge>}
                {!person.is_self && person.user_id && (
                  <div className="grid w-full grid-cols-2 gap-2 pt-2">
                    <Button icon={MessageCircle} disabled={busy === 'chat'} onClick={() => run('chat', () => startChat(slug, person, navigateTo))}>Message</Button>
                    <Button variant={person.is_connected ? 'secondary' : 'accent'} icon={person.is_connected ? BookmarkCheck : BookmarkPlus} disabled={busy === 'save' || person.is_connected} onClick={saveContact}>
                      {person.is_connected ? 'Saved' : 'Save contact'}
                    </Button>
                  </div>
                )}
                {person.is_self && <p className="text-subtle text-sm">This is how other delegates see you. Edit it in My profile.</p>}
              </Card>
              {person.app_bio && (
                <Card>
                  <CardTitle>About</CardTitle>
                  <p className="whitespace-pre-line text-sm leading-relaxed">{person.app_bio}</p>
                </Card>
              )}
              {(person.interests?.length > 0 || person.linkedin_url) && (
                <Card>
                  {person.interests?.length > 0 && (
                    <>
                      <CardTitle>Interests</CardTitle>
                      <ul className="mb-3 flex flex-wrap gap-1.5">{person.interests.map((interest) => <li key={interest}><Badge>{interest}</Badge></li>)}</ul>
                    </>
                  )}
                  {person.linkedin_url && (
                    <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-dark underline dark:text-mint">
                      <Linkedin size={16} aria-hidden="true" /> LinkedIn profile
                    </a>
                  )}
                </Card>
              )}
            </>
          )}
        </LoadState>
      </Body>
    </>
  )
}
