import { useEffect, useState } from 'react'

const SIZES = { sm: 'size-9 text-xs', md: 'size-11 text-sm', lg: 'size-20 text-2xl', xl: 'size-28 text-3xl' }

export function initials(name = '') {
  return String(name)
    .replace(/^[('"[\s]+/, '')
    .replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|H\.E\.?)\s+/i, '')
    .replace(/^[('"[\s]+/, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/^[^A-Za-z0-9]+/, '')[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** A person's photo, or their initials when there is none (or it fails to load). */
export default function Avatar({ name, photoUrl, size = 'md', shape = 'circle', className = '' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [photoUrl])
  const showPhoto = photoUrl && !failed
  const radius = shape === 'square' ? 'rounded-xl' : 'rounded-full'

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden bg-teal font-black text-ink ${radius} ${SIZES[size]} ${className}`}>
      {showPhoto ? (
        <img src={photoUrl} alt="" className="size-full object-cover" onError={() => setFailed(true)} loading="lazy" />
      ) : (
        <span aria-hidden="true">{initials(name) || '?'}</span>
      )}
    </span>
  )
}
