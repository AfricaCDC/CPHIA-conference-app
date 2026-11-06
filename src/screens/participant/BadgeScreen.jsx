import { QRCodeSVG } from 'qrcode.react'
import Card, { InfoRow } from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import RegisterPrompt from '../../components/ui/RegisterPrompt'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { formatDateTime } from '../../lib/format'
import { useRegistration } from '../../lib/useParticipant'
import { useSessionStore } from '../../store/sessionStore'
import { useBrandStore } from '../../store/brandStore'

const STATUS = {
  pending: 'not yet printed',
  ready: 'printed · ready for collection',
  collected: 'collected',
}

/** The badge QR, where to collect the printed badge and the box it is packed in. */
export default function BadgeScreen() {
  const user = useSessionStore((state) => state.user)
  const theme = useBrandStore((state) => state.theme)
  const { registration, loading, error, reload } = useRegistration()
  const collection = registration?.badge_collection
  const category = [registration?.category_name, registration?.journey?.title].filter(Boolean).join(' · ') || 'Delegate'

  return (
    <>
      <ScreenHeader kicker="Badge" title="My badge" back />
      <Body>
        <LoadState loading={loading} error={error} onRetry={reload}>
          {!registration && !loading ? (
            <RegisterPrompt what="badge" onLinked={reload} />
          ) : !registration?.badge_qr_payload ? (
            <Card>
              <span className="t">Badge not available yet</span>
              <span className="s">Your badge appears here once your registration is approved and any payment or sponsorship is cleared.</span>
            </Card>
          ) : (
            <>
              <Card tone="teal" className="items-center gap-3 text-center" aria-label="Digital badge">
                <span className="rounded-xl bg-cream p-3">
                  <QRCodeSVG value={registration.badge_qr_payload} size={190} level="M" bgColor={theme.surface} fgColor={theme.ink} title="Badge QR code" />
                </span>
                <span className="t text-lg">{registration.registrant_name ?? user?.name}</span>
                {(registration.organization ?? user?.organization) && <span className="s">{registration.organization ?? user?.organization}</span>}
                <span className="pill bg-ink text-cream">{category}</span>
                {collection?.badge_id && <span className="font-mono text-xs font-bold tracking-wider">Badge #{collection.badge_id}</span>}
              </Card>
              <Card>
                <span className="t">Where to collect</span>
                <span className="s">{collection?.instructions}</span>
                <span className="s">Status: <b>{STATUS[collection?.status] ?? STATUS.pending}</b></span>
              </Card>
              {collection && (collection.packing_label || collection.printed_at) && (
                <Card>
                  <span className="t">Packing details</span>
                  <span className="s">Tell the desk these if they ask, so they find your badge fast.</span>
                  <dl>
                    {collection.badge_id && <InfoRow label="Badge number" value={collection.badge_id} />}
                    {collection.packing_list && <InfoRow label="Packing list" value={collection.packing_list} />}
                    {collection.box_batch && <InfoRow label="Box" value={collection.box_batch} />}
                    {collection.printed_at && <InfoRow label="Printed" value={formatDateTime(collection.printed_at)} />}
                    {collection.issued_at && <InfoRow label="Collected" value={formatDateTime(collection.issued_at)} />}
                  </dl>
                </Card>
              )}
              <Card>
                <span className="t">Use the QR to</span>
                <span className="s">Enter sessions and side events that need registration, exchange contacts and connect with other delegates. It works offline once opened.</span>
              </Card>
            </>
          )}
        </LoadState>
      </Body>
    </>
  )
}
