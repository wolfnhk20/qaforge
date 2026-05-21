export type StagingUrlValidation =
  | { ok: true; normalized: string }
  | { ok: false; error: string }

/** Validate http(s) staging base URL for runtime probe execution. */
export function validateStagingUrl(raw: string): StagingUrlValidation {
  const value = (raw || '').trim()
  if (!value) {
    return { ok: false, error: 'Staging URL is required.' }
  }

  if (/\s/.test(value)) {
    return { ok: false, error: 'Staging URL must not contain spaces.' }
  }

  try {
    const parsed = new URL(value.includes('://') ? value : `https://${value}`)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, error: 'URL must use http:// or https://.' }
    }
    if (!parsed.hostname) {
      return { ok: false, error: 'Enter a valid hostname (e.g. abcd.ngrok-free.app).' }
    }
    const normalized = `${parsed.protocol}//${parsed.host}`.replace(/\/$/, '')
    return { ok: true, normalized }
  } catch {
    return { ok: false, error: 'Invalid URL format. Example: https://abcd.ngrok-free.app' }
  }
}
