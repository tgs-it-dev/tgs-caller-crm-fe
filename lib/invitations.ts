import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type Invitation = components['schemas']['InvitationResponse']
type Session = components['schemas']['TokenResponse']

/**
 * The emailed link's token travels in the body, never in the path.
 *
 * The API is built that way on purpose — a URL ends up in access logs, and this
 * token sets somebody's password. A page that put it back in one would undo
 * that, so these calls post it instead.
 *
 * None of them carry a session: whoever follows one of these links has no way
 * in yet, which is the whole point. So no `withSession` here — there is nothing
 * to renew.
 */
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<T>
}

/** Who a live invitation belongs to, so the page can greet them by name. */
export function readInvitation(token: string): Promise<Invitation> {
  return post<Invitation>('/auth/invitations/lookup', { token })
}

/** Spend the invitation and get a session back — they land signed in. */
export function acceptInvitation(token: string, password: string): Promise<Session> {
  return post<Session>('/auth/invitations/accept', { token, password })
}

/** Spend a reset link. Every session the old password opened ends server-side. */
export function resetPassword(token: string, newPassword: string): Promise<Session> {
  return post<Session>('/auth/password/reset', { token, new_password: newPassword })
}

/**
 * Ask for a reset link.
 *
 * Answers 202 for an address nobody holds exactly as it does for a real one, so
 * there is nothing here to tell the two apart — and the screen must not either.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(apiUrl('/auth/password/forgot'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw await authError(res)
}
