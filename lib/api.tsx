import type { paths } from '@/lib/generated/schema'

// Thin wrapper: if generated client exists, consume it; otherwise fall back to fetch.
export async function fetchApi<Path extends keyof paths>(path: string, init?: RequestInit) {
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  const url = base ? `${base}${path}` : path
  const res = await fetch(url, init)
  return res.json()
}

export const api = {
  fetch: fetchApi,
}
