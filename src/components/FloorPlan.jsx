import { openInAppDocument } from '../lib/files'

/** A floor plan in full: images show whole, PDFs open inside the app viewer. */
export default function FloorPlan({ url, kind, title }) {
  if (!url) return null
  if (kind === 'pdf') {
    return (
      <button
        type="button"
        className="btn o sm"
        onClick={() => openInAppDocument(url, { title: title ? `${title} floor plan` : 'Floor plan', kind: 'pdf' })}
      >
        Floor plan (PDF)
      </button>
    )
  }
  return <img src={url} alt={`Floor plan of ${title ?? 'this venue'}`} loading="lazy" decoding="async" className="h-auto w-full rounded-2xl border border-line bg-white object-contain" />
}
