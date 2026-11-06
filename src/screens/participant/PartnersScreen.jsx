import Card from '../../components/ui/Card'
import ListRow from '../../components/ui/ListRow'
import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body, Chips } from '../../components/ui/ScreenHeader'
import { listOf } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'partners', label: 'Sponsors & partners' },
  { id: 'exhibitors', label: 'Exhibitors' },
]

/** Sponsors, partners and exhibitors at the conference. */
export default function PartnersScreen() {
  const slug = useEventSlug()
  const partners = useRemote(`/events/${encodeURIComponent(slug)}/partners`)
  const exhibitors = useRemote(`/events/${encodeURIComponent(slug)}/exhibitions`)
  const [filter, setFilter] = useState('all')
  const rows = [
    ...(filter !== 'exhibitors' ? listOf(partners.data).map((p) => ({ id: `p${p.id}`, name: p.name, detail: p.description ?? p.category, tier: p.tier ?? p.category ?? 'Partner', url: p.website ?? p.url, code: p.booth ?? '' })) : []),
    ...(filter !== 'partners' ? listOf(exhibitors.data).map((e) => ({ id: `e${e.id}`, name: e.name ?? e.organization ?? e.title, detail: e.description ?? e.sector, tier: 'Exhibitor', url: e.website, code: e.booth_number ?? e.booth ?? '' })) : []),
  ]

  return (
    <>
      <ScreenHeader kicker="Partners and exhibitors" title="Who is in the hall" back>
        <Chips label="Filter" options={FILTERS} value={filter} onChange={setFilter} />
      </ScreenHeader>
      <Body>
        <LoadState loading={partners.loading && exhibitors.loading} error={partners.error && exhibitors.error} onRetry={() => { partners.reload(); exhibitors.reload() }}>
          {rows.length === 0 ? (
            <div className="empty">Partners and exhibitors will be listed here closer to the conference.</div>
          ) : (
            <Card className="card gap-0">
              {rows.map((row) => (
                <ListRow key={row.id}>
                  <span className="grid size-[42px] shrink-0 place-items-center rounded-[10px] bg-mint-soft text-[11px] font-black">{row.code || row.name?.slice(0, 2).toUpperCase()}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="t">{row.name}</span>
                    {row.detail && <span className="s line-clamp-2">{row.detail}</span>}
                  </span>
                  <span className={`pill ${/platinum/i.test(row.tier) ? 'y' : ''}`}>{row.tier}</span>
                  {row.url && <a href={row.url} target="_blank" rel="noopener noreferrer" aria-label={`Website of ${row.name}`} className="text-maroon"><ExternalLink size={16} /></a>}
                </ListRow>
              ))}
            </Card>
          )}
          <Card className="card mint">
            <span className="t">Exhibition hall</span>
            <span className="s">Open during the conference. See the venue for the hall and booth locations.</span>
          </Card>
        </LoadState>
      </Body>
    </>
  )
}
