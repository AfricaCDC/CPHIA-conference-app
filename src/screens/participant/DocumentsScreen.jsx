import Card, { CardButton } from '../../components/ui/Card'
import ListRow from '../../components/ui/ListRow'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { openProtectedFile } from '../../lib/files'
import { useRegistration } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

/** Letters and papers to download. DSA uploads are in Finance. */
export default function DocumentsScreen() {
  const showToast = useAppStore((state) => state.showToast)
  const { registration, loading, error, reload } = useRegistration()
  const base = registration ? `/participant/registrations/${registration.id}` : null
  const docs = useRemote(base && `${base}/documents`)
  const navigateTo = useAppStore((state) => state.navigateTo)
  const items = docs.data?.data?.items ?? []

  return (
    <>
      <ScreenHeader kicker="Documents" title="Badge and papers" back />
      <Body>
        <LoadState loading={loading} error={error} onRetry={reload}>
          <Card className="card gap-0">
            {items.length === 0 && <div className="empty">Your documents appear here once they are issued.</div>}
            {items.map((doc) => (
              <ListRow key={doc.type} onClick={doc.available ? () => openProtectedFile(doc.download_url).catch((e) => showToast(e.message, 'info')) : undefined}>
                <span className="grid size-[42px] shrink-0 place-items-center rounded-[10px] bg-mint-soft text-[11px] font-black">PDF</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t">{doc.label}</span>
                  <span className="s">{doc.available ? 'Ready' : 'Not ready yet'}</span>
                </span>
                <span className={`s font-bold ${doc.available ? 'text-maroon' : ''}`}>{doc.available ? 'Open' : 'Waiting'}</span>
              </ListRow>
            ))}
          </Card>

          <CardButton className="row text-left" onClick={() => navigateTo('finance')}>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="t">DSA documents and payments</span>
              <span className="s">Travel claim, boarding pass, extra costs, bank details and your DSA, in Finance</span>
            </span>
            <span aria-hidden="true">›</span>
          </CardButton>
        </LoadState>
      </Body>
    </>
  )
}
