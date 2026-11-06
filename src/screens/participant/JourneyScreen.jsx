import Card, { StepRow } from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import RegisterPrompt from '../../components/ui/RegisterPrompt'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { useRegistration } from '../../lib/useParticipant'
import { useAppStore } from '../../store/appStore'

const STATE = { done: 'ok', current: 'warn' }

/**
 * My journey, as on the participant page of the website. The steps depend on the delegate's
 * category: fully sponsored (Africa CDC implements), partially sponsored, or self-sponsored.
 * Self-sponsored delegates see their own hotel and venue guidance instead of the covered summary.
 */
export default function JourneyScreen() {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const { registration, loading, error, reload } = useRegistration()
  const journey = registration?.journey
  const self = journey?.lane === 'self'
  const selfServe = journey?.self_serve
  const badge = registration?.badge_collection
  const badgeStep = {
    pending: ['off', 'Badge collected', 'Printed before you arrive'],
    ready: ['warn', 'Badge ready for collection', 'Show your badge QR at the desk'],
    collected: ['ok', 'Badge collected', 'Handed over at the desk'],
  }[badge?.status] ?? ['off', 'Badge collected', null]

  return (
    <>
      <ScreenHeader kicker={self ? 'Self-sponsored' : journey?.subtitle ?? 'Registration'} title="My journey" back />
      <Body>
        <LoadState loading={loading && !registration} error={error} onRetry={reload}>
          {!registration && !loading && <RegisterPrompt what="journey" />}
          {journey && (
            <div className="flex flex-wrap items-center gap-2">
              {!self && <span className="pill t">{journey.title}{journey.subtitle ? ` · ${journey.subtitle}` : ''}</span>}
              {!self && journey.badge_label && <span className="pill">Badge: {journey.badge_label}</span>}
            </div>
          )}
          {!self && journey?.covered_summary && <p className="s">{journey.covered_summary}</p>}

          {journey?.steps?.length > 0 && (
            <Card className="gap-0">
              {journey.steps.map((step) => (
                <StepRow key={step.key} state={STATE[step.state] ?? 'off'} title={step.label} detail={step.detail} />
              ))}
              <StepRow state={badgeStep[0]} title={badgeStep[1]} detail={badgeStep[2] ?? badge?.instructions} />
            </Card>
          )}

          {selfServe?.hotel && (
            <Card>
              <span className="t">{selfServe.hotel.title}</span>
              <span className="s">{selfServe.hotel.body}</span>
              <button type="button" className="btn o sm" onClick={() => navigateTo('accommodation')}>{selfServe.hotel.cta_label}</button>
            </Card>
          )}
          {selfServe?.venue && (
            <Card>
              <span className="t">{selfServe.venue.title}</span>
              <span className="s">{selfServe.venue.body}</span>
              <button type="button" className="btn o sm" onClick={() => navigateTo('transport')}>Shuttle routes and I am waiting</button>
            </Card>
          )}
        </LoadState>
      </Body>
    </>
  )
}
