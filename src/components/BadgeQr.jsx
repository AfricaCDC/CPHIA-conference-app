import { QRCodeSVG } from 'qrcode.react'
import { useBrandStore } from '../store/brandStore'

/** The badge QR on a cream tile, as in the wireframe. */
export default function BadgeQr({ value, size = 62, title }) {
  const theme = useBrandStore((state) => state.theme)
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-lg bg-cream p-[7px]">
      <QRCodeSVG value={value} size={size} level="M" bgColor={theme.surface} fgColor={theme.ink} title={title} aria-hidden={title ? undefined : true} />
    </span>
  )
}
