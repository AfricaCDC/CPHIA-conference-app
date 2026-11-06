import { ExternalLink } from 'lucide-react'

/** A floor plan in full: images show whole, PDFs open from a button. */
export default function FloorPlan({ url, kind, title }) {
  if (!url) return null
  if (kind === 'pdf') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn o sm">
        Floor plan (PDF) <ExternalLink size={14} aria-hidden="true" />
      </a>
    )
  }
  return <img src={url} alt={`Floor plan of ${title ?? 'this venue'}`} loading="lazy" decoding="async" className="h-auto w-full rounded-2xl border border-line bg-white object-contain" />
}
