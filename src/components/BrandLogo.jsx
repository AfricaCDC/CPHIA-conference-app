import { useBrandStore } from '../store/brandStore'

// The website's logo file; the event can replace it with its own logo_url from the API.
const DEFAULT_LOGO = `${import.meta.env.BASE_URL}brand/cphia-logo.png`

/** The CPHIA 2026 logo, white on the teal header, as on the website. */
export default function BrandLogo({ className = 'h-12' }) {
  const logoUrl = useBrandStore((state) => state.logoUrl)
  return (
    <img
      src={logoUrl || DEFAULT_LOGO}
      alt="CPHIA 2026 - International Conference on Public Health in Africa"
      className={`brand-logo ${className} w-auto object-contain`}
      loading="eager"
    />
  )
}
