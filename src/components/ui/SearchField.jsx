import { useRef } from 'react'
import { IonSearchbar } from '@ionic/react'

/**
 * Shared header search: Ionic pill + clear button, with the phone keyboard's Search key
 * wired so Android Chrome / installed PWAs actually commit the query (Enter alone used
 * to do nothing because ion-searchbar was not inside a form).
 */
export default function SearchField({ label, value, onChange, placeholder }) {
  const barRef = useRef(null)

  function readValue() {
    const el = barRef.current
    if (!el) return value ?? ''
    // Prefer the live native value — controlled React state can lag one keystroke behind
    // on Android when the Search key is pressed immediately after typing.
    if (typeof el.value === 'string') return el.value
    return value ?? ''
  }

  function commit(next = readValue()) {
    onChange(next)
  }

  function onSubmit(event) {
    event.preventDefault()
    commit()
    // Dismiss the soft keyboard so staff can see the filtered list.
    const active = document.activeElement
    if (active && typeof active.blur === 'function') active.blur()
    else barRef.current?.getInputElement?.().then((input) => input?.blur?.()).catch(() => {})
  }

  return (
    <form className="app-search-form m-0" action="#" role="search" onSubmit={onSubmit}>
      <IonSearchbar
        ref={barRef}
        className="app-search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        type="search"
        inputmode="search"
        enterkeyhint="search"
        debounce={0}
        onIonInput={(event) => commit(event.detail.value ?? '')}
        onIonChange={(event) => commit(event.detail.value ?? '')}
        onIonClear={() => commit('')}
      />
    </form>
  )
}
