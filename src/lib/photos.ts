/** Car photo uploads to the Supabase Storage `car-photos` bucket. */
import { PHOTO_BUCKET, SUPABASE_URL, describeError, getSupabase } from './supabase'

const MAX_EDGE = 2000
const PUBLIC_PREFIX = () => `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/`

/** Resize large photos in the browser so uploads are fast on mobile data. */
async function compress(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85),
    )
    const out =
      blob && blob.type === 'image/webp'
        ? blob
        : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return out && out.size < file.size ? out : file
  } catch {
    return file
  }
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

/** Upload one photo and return its public URL. */
export async function uploadCarPhoto(file: File): Promise<string> {
  const sb = getSupabase()
  const blob = await compress(file)
  const type = blob.type || file.type
  const path = `cars/${crypto.randomUUID()}.${EXT[type] ?? 'jpg'}`
  const { error } = await sb.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false })
  if (error) throw new Error(`Photo upload failed: ${describeError(error)}`)
  return sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Storage path for a URL in our bucket, or null for other URLs. */
export function storagePath(url: string): string | null {
  const prefix = PUBLIC_PREFIX()
  return SUPABASE_URL && url.startsWith(prefix)
    ? decodeURIComponent(url.slice(prefix.length).split('?')[0])
    : null
}

/** Best-effort removal of photos from storage. Returns an error message if it failed. */
export async function removeCarPhotos(urls: string[]): Promise<string | null> {
  const paths = urls.map(storagePath).filter((p): p is string => Boolean(p))
  if (paths.length === 0) return null
  const { error } = await getSupabase().storage.from(PHOTO_BUCKET).remove(paths)
  return error ? describeError(error) : null
}
