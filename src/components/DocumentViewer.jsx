import { useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { useDocumentViewerStore } from '../lib/files'

/** Full-screen in-app document viewer for PDFs and images opened from Documents / Finance / Travel. */
export default function DocumentViewer() {
  const doc = useDocumentViewerStore((state) => state.doc)
  const close = useDocumentViewerStore((state) => state.close)

  useEffect(() => {
    if (!doc) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [doc, close])

  if (!doc) return null

  const download = () => {
    const link = document.createElement('a')
    link.href = doc.url
    link.download = doc.title || 'document'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <div className="document-viewer" role="dialog" aria-modal="true" aria-label={doc.title || 'Document'}>
      <div className="document-viewer__bar">
        <button type="button" className="iconbtn" onClick={close} aria-label="Close document">
          <X size={20} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="kick truncate">Document</p>
          <h2 className="m-0 truncate text-[16px] font-black leading-tight">{doc.title || 'Preview'}</h2>
        </div>
        <button type="button" className="iconbtn" onClick={download} aria-label="Download document">
          <Download size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="document-viewer__body">
        {doc.kind === 'image' ? (
          <img src={doc.url} alt={doc.title || 'Document'} className="document-viewer__image" />
        ) : (
          <iframe
            title={doc.title || 'Document preview'}
            src={doc.url}
            className="document-viewer__frame"
          />
        )}
      </div>
    </div>
  )
}
