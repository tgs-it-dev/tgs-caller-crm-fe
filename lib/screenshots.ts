import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'
import type { DateRange } from '@/lib/reporting'

export type ScreenshotItem = components['schemas']['ScreenshotItem']
export type ScreenshotList = components['schemas']['ScreenshotListResponse']

/** Narrows the log; a filter left null is not applied. */
export type ScreenshotQuery = {
  teamId: string | null
  userId: string | null
  limit: number
  offset: number
}

/**
 * One page of Print Screen presses in a range of days, newest first. Super Admin
 * only. Like the reports, no `timezone` is sent: the server reads the days in the
 * user's own zone and names it in the reply.
 */
export async function listScreenshots(
  range: DateRange,
  { teamId, userId, limit, offset }: ScreenshotQuery,
  token: string
): Promise<ScreenshotList> {
  const query = new URLSearchParams({ ...range, limit: String(limit), offset: String(offset) })
  if (teamId) query.set('team_id', teamId)
  if (userId) query.set('user_id', userId)
  const res = await fetch(apiUrl(`/auth/screenshots?${query}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<ScreenshotList>
}

/** The page as the browser reported it. Any signed-in user can send any path. */
function parse(page: string): URL | null {
  try {
    return new URL(page, 'https://crm.invalid')
  } catch {
    return null
  }
}

/** "/closer/workspace/?id=..." reads as "Closer workspace". */
export function pageName(page: string): string {
  const segments = parse(page)?.pathname.split('/').filter(Boolean) ?? []
  if (segments.length === 0) return 'Home'
  const words = segments
    .join(' ')
    .replace(/-/g, ' ')
    .replace(/\bqa\b/g, 'QA')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The call a fronter or closer workspace was showing, when the page names one. */
export function callIdOf(page: string): string | null {
  const url = parse(page)
  if (!url || !/^\/(fronter|closer)\/workspace\/?$/.test(url.pathname)) return null
  return url.searchParams.get('id') || null
}
