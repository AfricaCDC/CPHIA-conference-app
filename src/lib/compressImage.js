/**
 * Resize/compress a photo Blob/File to roughly maxBytes (default 600 KiB) as JPEG.
 * Used for badge multi-issue evidence photos.
 */

const DEFAULT_MAX_BYTES = 600 * 1024
const MAX_EDGE = 1600

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that photo.'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

/**
 * @param {Blob|File} file
 * @param {{ maxBytes?: number, fileName?: string }} [options]
 * @returns {Promise<File>}
 */
export async function compressImageToLimit(file, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const fileName = options.fileName || (file.name ? String(file.name).replace(/\.\w+$/, '.jpg') : `photo-${Date.now()}.jpg`)

  if (file.size <= maxBytes && /^image\/jpe?g$/i.test(file.type || '')) {
    return file instanceof File ? file : new File([file], fileName, { type: 'image/jpeg' })
  }

  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  let quality = 0.82
  let blob = await canvasToBlob(canvas, quality)
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, quality)
  }

  // Still too large: shrink dimensions once more.
  if (blob && blob.size > maxBytes) {
    canvas.width = Math.max(1, Math.round(width * 0.75))
    canvas.height = Math.max(1, Math.round(height * 0.75))
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    quality = 0.72
    blob = await canvasToBlob(canvas, quality)
    while (blob && blob.size > maxBytes && quality > 0.35) {
      quality -= 0.08
      blob = await canvasToBlob(canvas, quality)
    }
  }

  if (!blob) throw new Error('Could not compress that photo.')
  return new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() })
}
