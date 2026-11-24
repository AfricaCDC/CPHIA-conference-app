import { Facebook, Linkedin, Youtube } from 'lucide-react'
import { openExternal } from '../lib/openExternal'
import { useEventSlug } from '../lib/useParticipant'
import { useRemote } from '../lib/useRemote'

function XIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const SOCIAL_ICONS = {
  facebook: Facebook,
  linkedin: Linkedin,
  x: XIcon,
}

/** Opening ceremony YouTube preview + subscribe / social links from Comms → Mobile app. */
export default function OpeningCeremonyCard() {
  const slug = useEventSlug()
  const { data } = useRemote(`/events/${encodeURIComponent(slug)}/mobile-home`)
  const ceremony = data?.data?.opening_ceremony
  if (!ceremony?.embed_url) return null

  const social = Array.isArray(ceremony.social) ? ceremony.social : []

  return (
    <section className="flex flex-col gap-3 px-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-extrabold">{ceremony.title || 'Opening ceremony'}</h2>
        {ceremony.subscribe_url ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-tertiary"
            onClick={() => openExternal(ceremony.subscribe_url)}
          >
            <Youtube size={16} aria-hidden="true" />
            Subscribe
          </button>
        ) : null}
      </div>

      <div className="lift overflow-hidden rounded-2xl bg-white">
        <div className="relative aspect-video w-full bg-ink/10">
          <iframe
            title={ceremony.title || 'Opening ceremony'}
            src={`${ceremony.embed_url}?rel=0`}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-maroon px-3.5 text-[13px] font-bold text-cream"
            onClick={() => openExternal(ceremony.youtube_url)}
          >
            <Youtube size={16} aria-hidden="true" />
            Watch on YouTube
          </button>
          {social.map((link) => {
            const Icon = SOCIAL_ICONS[link.key] || null
            return (
              <button
                key={link.key}
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-tertiary/25 px-3 text-[13px] font-bold text-tertiary"
                onClick={() => openExternal(link.url)}
                aria-label={link.label}
              >
                {Icon ? <Icon size={15} /> : null}
                {link.label}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
