import Card from './Card'
import { useSessionStore } from '../../store/sessionStore'

/** Shown in place of a delegate's own details when the account has no conference registration yet. */
export default function RegisterPrompt({ what }) {
  const registrationUrl = useSessionStore((state) => state.registrationUrl)

  return (
    <Card className="card">
      <span className="t">Register to see your {what}</span>
      <span className="s">Your staff account has no conference registration yet. Register as a delegate to get your badge, programme and travel.</span>
      {registrationUrl && <a href={registrationUrl} className="font-bold text-teal-dark underline">Register for the conference</a>}
    </Card>
  )
}
