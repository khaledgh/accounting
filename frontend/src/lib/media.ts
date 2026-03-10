const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_URL || ''

/**
 * Resolves a media URL path (e.g. "/uploads/...") to a full URL
 * using the VITE_UPLOADS_URL base. Passthrough for absolute URLs.
 */
export function getMediaUrl(path: string | undefined | null): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/uploads') && UPLOADS_BASE) return `${UPLOADS_BASE}${path}`
  return path
}
