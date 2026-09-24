import type { paths } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'

// Thin wrapper: if generated client exists, consume it; otherwise fall back to fetch.
export async function fetchApi<Path extends keyof paths>(path: string, init?: RequestInit) {
  const res = await fetch(apiUrl(path), init)
  return res.json()
}

export const api = {
  fetch: fetchApi,
}
