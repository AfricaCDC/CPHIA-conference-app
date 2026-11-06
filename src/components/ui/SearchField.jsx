import { IonSearchbar } from '@ionic/react'

/**
 * The one search field for every header, drawn by Ionic: a rounded pill with its own clear button
 * and the native keyboard search key on phones.
 */
export default function SearchField({ label, value, onChange, placeholder }) {
  return (
    <IonSearchbar
      className="app-search"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      enterkeyhint="search"
      onIonInput={(event) => onChange(event.detail.value ?? '')}
      onIonClear={() => onChange('')}
    />
  )
}
