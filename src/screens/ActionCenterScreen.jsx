import Card, { CardButton } from '../components/ui/Card'
import { Bell, CheckCircle2, ChevronRight } from 'lucide-react'
import { LoadState } from '../components/ui/LoadState'
import ScreenHeader, { Body } from '../components/ui/ScreenHeader'
import { MODULE_LABEL } from '../lib/actions'
import { useActionCenter } from '../lib/useParticipant'
import { useAppStore } from '../store/appStore'

const ORDER = ['accommodation', 'travel', 'visa', 'finance', 'messages', 'general']

/** Everything waiting for the delegate, grouped by module. Each row opens the place to act. */
export default function ActionCenterScreen() {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const { items, loading, error, reload } = useActionCenter()
  const groups = ORDER.map((module) => [module, items.filter((item) => item.module === module)]).filter(([, list]) => list.length)

  return (
    <>
      <ScreenHeader kicker="To do" title="Action center" back />
      <Body>
        <LoadState loading={loading && !items.length} error={error} onRetry={reload}>
          {items.length === 0 ? (
            <Card className="card mint flex items-center gap-3">
              <CheckCircle2 size={28} className="text-tertiary" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="t">You are all caught up</span>
                <span className="s">Nothing needs you right now. We will tell you when something does.</span>
              </div>
            </Card>
          ) : (
            <>
              <p className="s">{items.length} thing{items.length === 1 ? '' : 's'} to do. Tap one to go straight to it.</p>
              {groups.map(([module, list]) => (
                <section key={module} className="flex flex-col gap-2">
                  <h2 className="text-[12px] font-extrabold uppercase tracking-wider text-muted">{MODULE_LABEL[module]}</h2>
                  {list.map((item) => (
                    <CardButton key={item.key} onClick={() => navigateTo(item.screen, item.params)} className="row text-left">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-maroon text-cream" aria-hidden="true"><Bell size={18} /></span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="t">{item.title}</span>
                        {item.detail && <span className="s line-clamp-2">{item.detail}</span>}
                      </span>
                      <ChevronRight size={18} className="shrink-0 opacity-60" aria-hidden="true" />
                    </CardButton>
                  ))}
                </section>
              ))}
            </>
          )}
        </LoadState>
      </Body>
    </>
  )
}
