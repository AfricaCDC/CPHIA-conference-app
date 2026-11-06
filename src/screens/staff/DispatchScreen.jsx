import Card from '../../components/ui/Card'
import { useState } from 'react'
import { api } from '../../lib/api'
import { useEventSlug } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { LoadState } from '../../components/ui/LoadState'
import { useAppStore } from '../../store/appStore'

function formatWhen(iso) {
  return iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : null
}

/** Dispatch officer's desk, as on the wireframe: counts, who is waiting, and ride requests to assign a car to. */
export default function DispatchScreen() {
  const slug = useEventSlug()
  const showToast = useAppStore((state) => state.showToast)
  const { data, loading, error, reload } = useRemote(`/events/${encodeURIComponent(slug)}/transport-desk`)
  const board = data?.data
  const [choosing, setChoosing] = useState(null)
  const [busy, setBusy] = useState(false)

  async function assign(ride, car) {
    setBusy(true)
    try {
      await api(`/events/${encodeURIComponent(slug)}/transport-desk/rides/${ride.id}/assign`, { method: 'POST', body: { vehicle_id: car.id } })
      showToast(`${car.plate} assigned to ${ride.name}`)
      setChoosing(null)
      reload()
    } catch (err) {
      showToast(err.message, 'info')
    } finally {
      setBusy(false)
    }
  }

  return (
    <LoadState loading={loading && !board} error={error} onRetry={reload}>
      {board && (
        <>
          <div className="kpi">
            <div><b>{board.kpis.waiting}</b><span>waiting</span></div>
            <div><b>{board.kpis.on_trip}</b><span>on trip</span></div>
            <div><b>{board.kpis.free}</b><span>free</span></div>
          </div>

          <h2 className="h3">Waiting</h2>
          {board.waiting.length === 0 && <div className="empty">Nobody is waiting at a stop.</div>}
          <div className="flex flex-col gap-2.5">
            {board.waiting.map((stop) => (
              <Card key={stop.stop_id} className="card row">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t">{stop.stop}</span>
                  <span className="s">{stop.route}</span>
                </div>
                <span className="pill y">{stop.passengers} waiting</span>
              </Card>
            ))}
          </div>

          <h2 className="h3">Ride requests</h2>
          {board.requests.length === 0 && <div className="empty">No ride requests to assign.</div>}
          <div className="flex flex-col gap-2.5">
            {board.requests.map((ride) => (
              <Card key={ride.id} className="card flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="t">{ride.name}</span>
                  <span className="s">{[ride.pickup, ride.dropoff].filter(Boolean).join(' → ')}</span>
                  <span className="s">{[formatWhen(ride.when), `${ride.passengers} passenger${ride.passengers === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</span>
                </div>
                {choosing === ride.id ? (
                  <div className="flex flex-col gap-2">
                    {board.cars.length === 0 && <span className="s">No free car with a driver.</span>}
                    {board.cars.map((car) => (
                      <button key={car.id} type="button" disabled={busy} onClick={() => assign(ride, car)} className="btn o sm">
                        {car.plate}{car.driver ? ` · ${car.driver}` : ''}
                      </button>
                    ))}
                    <button type="button" className="btn sm" onClick={() => setChoosing(null)}>Cancel</button>
                  </div>
                ) : (
                  <button type="button" className="btn y sm" onClick={() => setChoosing(ride.id)}>Assign a car</button>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </LoadState>
  )
}
