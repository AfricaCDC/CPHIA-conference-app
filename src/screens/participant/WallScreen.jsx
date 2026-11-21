import { useEffect, useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import Card from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { api } from '../../lib/api'
import { formatDayLong } from '../../lib/format'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'
import { useSessionStore } from '../../store/sessionStore'

const WALL_TITLE = 'CPHIA 2026 wall'
const WALL_SUBTITLE = '5th International Conference on Public Health in Africa'

/**
 * The conference wall: everyone who attended and chose to be listed. It opens after the event.
 * Joining is the delegate's own choice and can be undone at any time. The app shows name,
 * organisation, country and photo to other participants; if an admin publishes the wall on the
 * website, name, title and organisation appear there. The consent text says both.
 */
export default function WallScreen() {
  const slug = useEventSlug()
  const base = `/events/${encodeURIComponent(slug)}/wall`
  const showToast = useAppStore((state) => state.showToast)
  const user = useSessionStore((state) => state.user)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [people, setPeople] = useState([])
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, reload } = useRemote(`${base}?page=${page}&search=${encodeURIComponent(query)}`)
  const meta = data?.meta ?? {}

  // Search waits for a pause in typing, then starts again from the first page.
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const items = data?.data?.items
    if (!items) return
    setPeople((current) => (meta.current_page > 1 ? [...current.filter((p) => !items.some((i) => i.public_id === p.public_id)), ...items] : items))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  async function change(method, message) {
    setBusy(true)
    try {
      await api(base, { method, body: method === 'POST' ? { consent: true } : undefined })
      showToast(message)
      setAgreed(false)
      setPage(1)
      reload()
    } catch (err) {
      showToast(err.fieldErrors?.wall?.[0] ?? err.message, 'info')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ScreenHeader kicker={WALL_SUBTITLE} title={WALL_TITLE} back />
      <Body>
        <LoadState loading={loading && !data} error={error} onRetry={reload}>
          {!meta.open ? (
            <Card tone="mint">
              <span className="t">The wall opens after the conference</span>
              <span className="s">
                {meta.opens_on ? `From ${formatDayLong(meta.opens_on)} you can add yourself to the wall of people who attended ${data?.data?.event_name || 'CPHIA 2026'}.` : 'You can add yourself once the conference has ended.'}
              </span>
            </Card>
          ) : meta.joined ? (
            <Card tone="mint">
              <span className="t">You are on the wall</span>
              <span className="s">Other participants see your name, organisation, country and photo here. If the organisers publish the wall on the conference website, your name, title and organisation appear there too. You can remove yourself at any time.</span>
              <button type="button" className="btn o sm" disabled={busy} onClick={() => change('DELETE', 'You have been removed from the wall')}>Remove me from the wall</button>
            </Card>
          ) : meta.can_join ? (
            <Card tone="yellow">
              <div className="flex items-center gap-3">
                <Avatar name={user?.name} photoUrl={user?.photo_url} size="md" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t">Add yourself to the wall</span>
                  <span className="s">Be listed among the people who attended the {WALL_SUBTITLE}.</span>
                </span>
              </div>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span className="s">Show my name, organisation, country and photo on the wall to other participants in this app. If the organisers publish the wall on the conference website, my name, title and organisation appear there too. I can remove myself at any time.</span>
              </label>
              <button type="button" className="btn" disabled={busy || !agreed} onClick={() => change('POST', 'You are on the wall')}>
                <UserPlus size={16} aria-hidden="true" />{busy ? 'Adding…' : 'Add me to the wall'}
              </button>
            </Card>
          ) : (
            <Card>
              <span className="t">The wall is for confirmed participants</span>
              <span className="s">You can see who attended, but only people with a confirmed registration can be added.</span>
            </Card>
          )}

          {meta.open && (
            <>
              <div className="relative">
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
                <input type="search" className="!pl-9" aria-label="Search the wall" placeholder="Search by name, organisation or country" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <span className="s" role="status">
                {meta.total ?? 0} {meta.total === 1 ? 'person' : 'people'} on the wall{query ? ` matching “${query}”` : ''}
              </span>
              {people.length === 0 && !loading && (
                <Card><span className="s">{query ? 'Nobody on the wall matches your search.' : 'Nobody is on the wall yet. Be the first.'}</span></Card>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                {people.map((person) => (
                  <div key={person.public_id} className={`flex flex-col items-center gap-1.5 rounded-[14px] border bg-white px-2.5 py-3 text-center ${person.is_self ? 'border-teal-dark' : 'border-line'}`}>
                    <Avatar name={person.name} photoUrl={person.photo_url} size="lg" />
                    <span className="t text-sm leading-tight">{person.name}{person.is_self ? ' (you)' : ''}</span>
                    {person.organization && <span className="s line-clamp-2">{person.organization}</span>}
                    {person.country && <span className="pill">{person.country}</span>}
                  </div>
                ))}
              </div>
              {meta.current_page < meta.last_page && (
                <button type="button" className="btn o sm" disabled={loading} onClick={() => setPage(meta.current_page + 1)}>{loading ? 'Loading…' : 'Show more'}</button>
              )}
            </>
          )}
        </LoadState>
      </Body>
    </>
  )
}
