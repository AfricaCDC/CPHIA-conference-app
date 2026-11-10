import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import Card from '../../components/ui/Card'
import { LoadState } from '../../components/ui/LoadState'
import ScreenHeader, { Body } from '../../components/ui/ScreenHeader'
import { api, firstFieldError } from '../../lib/api'
import { openProtectedFile } from '../../lib/files'
import { useRegistration } from '../../lib/useParticipant'
import { useRemote } from '../../lib/useRemote'
import { useAppStore } from '../../store/appStore'

export const EVISA_PORTAL = 'https://www.evisa.gov.et/'

/**
 * Countries whose citizens qualify for the Ethiopia eVisa. Keep the names as on the registration
 * (e.g. "Kenya"). Empty until the organisers confirm the list, so no one is told they qualify by mistake.
 */
export const EVISA_COUNTRIES = new Set([])

const MISSING_FIELDS = [
  ['passport_full_name', 'Full name (as on passport)', 'text'],
  ['passport_number', 'Passport number', 'text'],
  ['nationality', 'Nationality', 'text'],
  ['passport_expiry_date', 'Passport expiry date', 'date'],
]

/** Whether a delegate's country is on the eVisa list (ignores case and spacing). */
export function qualifiesForEvisa(country) {
  if (!country) return false
  const needle = country.trim().toLowerCase()
  return [...EVISA_COUNTRIES].some((name) => name.trim().toLowerCase() === needle)
}

/**
 * Visa: the official eVisa portal, a recommendation for the delegate's country, and the passport
 * details already captured at registration. The form only appears if something is still missing.
 */
export default function VisaScreen() {
  const navigateTo = useAppStore((state) => state.navigateTo)
  const showToast = useAppStore((state) => state.showToast)
  const { registration, loading: regLoading } = useRegistration()
  const path = registration ? `/participant/registrations/${registration.id}/visa-profile` : null
  const { data, loading, error, reload } = useRemote(path)
  const [form, setForm] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [busy, setBusy] = useState(false)
  const profile = data?.profile
  const letter = data?.invitation_letter ?? registration?.invitation_letter
  const locked = data?.profile_locked || letter?.visa_profile_locked
  const missing = (data?.missing_fields ?? []).length > 0
  const country = registration?.country ?? profile?.nationality ?? null
  const eligible = qualifiesForEvisa(country)

  async function save() {
    setBusy(true)
    setSaveError(null)
    try {
      await api(path, { method: 'PUT', body: Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])) })
      showToast('Passport details saved')
      setForm({})
      reload()
    } catch (err) {
      setSaveError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ScreenHeader kicker="Travel" title="Visa" back />
      <Body>
        <LoadState loading={regLoading || (loading && !data)} error={error} onRetry={reload}>
          <Card tone={eligible ? 'mint' : 'yellow'}>
            <span className="t">{eligible ? 'Get your eVisa now' : 'Check your visa option'}</span>
            <span className="s">
              {eligible
                ? `Citizens of ${country} qualify for the Ethiopia eVisa. Apply online before you travel, using the conference reference for CPHIA 2026.`
                : 'Check on the official portal whether your passport qualifies for the Ethiopia eVisa. If it does not, you can get a visa on arrival.'}
            </span>
            <a className="btn sm" href={EVISA_PORTAL} target="_blank" rel="noopener noreferrer">
              Open evisa.gov.et <ExternalLink size={15} aria-hidden="true" />
            </a>
          </Card>

          <Card>
            <span className="t">Visa on arrival</span>
            <span className="s">CPHIA counters at Bole International Airport help with visa on arrival. Bring printed and digital copies of your invitation letter and registration confirmation. Carry US$ 50 in cash, or pay by card at the counter. Diplomatic passports are exempt.</span>
          </Card>

          {registration && (
            <Card>
              <span className="t">Your passport, from registration</span>
              <dl className="flex flex-col">
                <div className="flex justify-between gap-3 border-b border-mint-soft py-2"><dt className="s">Name</dt><dd className="text-right text-sm font-bold">{profile?.passport_full_name ?? registration.registrant_name ?? '–'}</dd></div>
                <div className="flex justify-between gap-3 border-b border-mint-soft py-2"><dt className="s">Passport number</dt><dd className="text-right text-sm font-bold">{profile?.passport_number ?? '–'}</dd></div>
                <div className="flex justify-between gap-3 border-b border-mint-soft py-2"><dt className="s">Nationality</dt><dd className="text-right text-sm font-bold">{profile?.nationality ?? registration.country ?? '–'}</dd></div>
                <div className="flex justify-between gap-3 py-2"><dt className="s">Passport expiry</dt><dd className="text-right text-sm font-bold">{profile?.passport_expiry_date ?? '–'}</dd></div>
              </dl>
              {!missing && <span className="s">These details came from your registration. Contact the desk if anything is wrong.</span>}
            </Card>
          )}

          {letter && (
            <Card tone="mint">
              <span className="t">Invitation letter</span>
              <span className="s">{letter.status_label ?? letter.status}{letter.reference_code ? ` · ${letter.reference_code}` : ''}</span>
              {letter.can_download && letter.download_path && (
                <button type="button" className="btn o sm" onClick={() => openProtectedFile(letter.download_path, { title: 'Invitation letter' }).catch((e) => showToast(e.message, 'info'))}>View invitation letter</button>
              )}
            </Card>
          )}

          {missing && !locked && (
            <Card tone="yellow">
              <span className="t">Still needed for your invitation letter</span>
              <span className="s">{data.missing_fields.join(', ')}</span>
              {MISSING_FIELDS.map(([key, label, type]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="lab" htmlFor={key}>{label}</label>
                  <input id={key} type={type} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} aria-describedby={firstFieldError(saveError, key) ? `${key}-error` : undefined} />
                  {firstFieldError(saveError, key) && <span id={`${key}-error`} className="text-xs font-bold text-maroon">{firstFieldError(saveError, key)}</span>}
                </div>
              ))}
              {saveError && !Object.keys(saveError.fieldErrors ?? {}).length && <span className="text-xs font-bold text-maroon" role="alert">{saveError.message}</span>}
              <button type="button" className="btn y" disabled={busy || Object.keys(form).length === 0} onClick={save}>{busy ? 'Saving…' : 'Save passport details'}</button>
            </Card>
          )}

          {locked && (
            <Card>
              <span className="t">Passport details are on file</span>
              <span className="s">They are locked for your invitation letter. Contact the organisers if a correction is needed.</span>
            </Card>
          )}

          <Card>
            <span className="t">Need help with your visa?</span>
            <span className="s">Tell the desk what is blocking you: the note verbale, the embassy, the eVisa portal or a visa on arrival.</span>
            <button type="button" className="btn m" onClick={() => navigateTo('messages', { tab: 'desks' })}>Message the desk</button>
          </Card>
        </LoadState>
      </Body>
    </>
  )
}
