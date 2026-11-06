import { useState } from 'react'
import { Camera, Save, Trash2 } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card, { CardTitle } from '../components/ui/Card'
import ScreenHeader, { Body } from '../components/ui/ScreenHeader'
import { api } from '../lib/api'
import { useRegistration } from '../lib/useParticipant'
import { useRoles } from '../lib/roles'
import { useAppStore } from '../store/appStore'
import { useSessionStore } from '../store/sessionStore'

const FIELDS = [
  { key: 'job_title', label: 'Job title', max: 255 },
  { key: 'organization', label: 'Organisation', max: 255 },
  { key: 'networking_headline', label: 'Networking headline', max: 255, hint: 'One line other delegates see in the directory.' },
  { key: 'linkedin_url', label: 'LinkedIn URL', max: 500, type: 'url' },
]
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export default function ProfileScreen() {
  const user = useSessionStore((state) => state.user)
  const setUser = useSessionStore((state) => state.setUser)
  const showToast = useAppStore((state) => state.showToast)
  const roles = useRoles()
  const { registration, reload } = useRegistration()
  const assignedDesks = roles.desks.filter((desk) => desk.own)
  const [form, setForm] = useState(() => ({
    ...Object.fromEntries(FIELDS.map(({ key }) => [key, user?.[key] ?? ''])),
    app_bio: user?.app_bio ?? '',
    interests: (user?.interests ?? []).join(', '),
  }))
  const [busy, setBusy] = useState(null)

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

  const uploadPhoto = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) return showToast('Choose a photo under 5 MB', 'info')
    const body = new FormData()
    body.append('avatar', file)
    run('photo', async () => {
      const { data } = await api('/participant/app-profile/avatar', { method: 'POST', body })
      setUser(data.user)
      showToast('Profile photo updated')
    })
  }

  const removePhoto = () =>
    run('photo', async () => {
      const { data } = await api('/participant/app-profile/avatar', { method: 'DELETE' })
      setUser(data.user)
      showToast('Profile photo removed', 'info')
    })

  const save = (event) => {
    event.preventDefault()
    run('save', async () => {
      const interests = form.interests.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20)
      const { data } = await api('/participant/app-profile', { method: 'PUT', body: { ...form, interests } })
      setUser(data.user)
      showToast('Profile saved')
    })
  }

  const toggleVisibility = () =>
    run('visibility', async () => {
      const visible = !registration.networking_visible
      await api(`/participant/registrations/${registration.id}/networking`, {
        method: 'PUT',
        body: { networking_visible: visible },
      })
      reload()
      showToast(visible ? 'You are visible to other participants' : 'You are hidden from other participants')
    })

  return (
    <>
      <ScreenHeader kicker="Profile" title="My profile" back />
      <Body>
      <Card className="items-center text-center">
        <Avatar name={user?.name} photoUrl={user?.photo_url} size="xl" />
        <div>
          <h2 className="text-xl font-black">{user?.name}</h2>
          <p className="text-subtle text-sm">{user?.email}</p>
        </div>
        <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Your roles">
          {roles.isParticipant && <li><Badge>Delegate</Badge></li>}
          {user?.is_superadmin ? (
            <li><Badge tone="teal">System admin</Badge></li>
          ) : (
            <>
              {/* Admins can open every desk, but the profile lists only the roles assigned to this account. */}
              {assignedDesks.map((desk) => <li key={desk.key}><Badge tone="teal">{desk.label}</Badge></li>)}
              {assignedDesks.length === 0 && roles.isStaff && <li><Badge tone="teal">Administrator</Badge></li>}
            </>
          )}
        </ul>
        <div className="flex flex-wrap justify-center gap-2">
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl bg-ink px-3 text-xs font-extrabold text-cream">
            <Camera size={16} aria-hidden="true" />
            {busy === 'photo' ? 'Uploading…' : user?.photo_url ? 'Change photo' : 'Add photo'}
            <input type="file" accept="image/*" className="sr-only" onChange={uploadPhoto} disabled={busy === 'photo'} />
          </label>
          {user?.photo_url && <Button size="sm" variant="secondary" icon={Trash2} onClick={removePhoto} disabled={busy === 'photo'}>Remove</Button>}
        </div>
      </Card>

      {registration && roles.isParticipant && (
        <Card>
          <CardTitle aside={<Badge tone={registration.networking_visible ? 'teal' : 'sun'}>{registration.networking_visible ? 'Visible' : 'Hidden'}</Badge>}>
            Delegate directory
          </CardTitle>
          <p className="text-subtle mb-3 text-sm">When visible, other delegates can find you, save you as a contact and message you. You need this on to message others.</p>
          <Button variant={registration.networking_visible ? 'secondary' : 'primary'} className="w-full" onClick={toggleVisibility} disabled={busy === 'visibility'}>
            {registration.networking_visible ? 'Hide me from the directory' : 'Show me in the directory'}
          </Button>
        </Card>
      )}

      <Card>
        <CardTitle>About me</CardTitle>
        <form onSubmit={save} className="space-y-3">
          {FIELDS.map(({ key, label, max, hint, type }) => (
            <label key={key} className="block space-y-1">
              <span className="text-sm font-semibold">{label}</span>
              <input type={type ?? 'text'} maxLength={max} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              {hint && <span className="text-subtle block text-xs">{hint}</span>}
            </label>
          ))}
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Short bio</span>
            <textarea rows={4} maxLength={2000} value={form.app_bio} onChange={(e) => setForm({ ...form, app_bio: e.target.value })} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Interests</span>
            <input value={form.interests} onChange={(e) => setForm({ ...form, interests: e.target.value })} placeholder="Genomics, One Health, Vaccines" />
            <span className="text-subtle block text-xs">Separate with commas.</span>
          </label>
          <Button type="submit" icon={Save} className="w-full" disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save profile'}</Button>
        </form>
      </Card>
      </Body>
    </>
  )
}
