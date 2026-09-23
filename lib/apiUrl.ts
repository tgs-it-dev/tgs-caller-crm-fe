/** Prefix `path` with `NEXT_PUBLIC_API_URL` when set; otherwise return `path` as-is (MSW). */
export function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '')
  return `${base}${path}`
}

/** True when the app talks to a real backend (MSW must stay off). */
export function isLiveApi(): boolean {
  return Boolean((process.env.NEXT_PUBLIC_API_URL || '').trim())
}

/** The same address for a WebSocket (`ws`/`wss`), or null under MSW, which can't mock one. */
export function wsUrl(path: string): string | null {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '')
  if (!base) return null
  // Resolved against the page, so a same-origin path like "/api" works as well
  // as a full address.
  const url = new URL(`${base}${path}`, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
