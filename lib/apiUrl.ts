/** Prefix `path` with `NEXT_PUBLIC_API_URL` when set; otherwise return `path` as-is (MSW). */
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  return `${base}${path}`
}
