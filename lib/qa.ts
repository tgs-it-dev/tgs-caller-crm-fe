import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError, type Role } from '@/lib/auth'

export type QaItem = components['schemas']['QaItemResponse']
export type QaItemList = components['schemas']['QaItemListResponse']
export type QaItemDetail = components['schemas']['QaItemDetailResponse']
export type QaStatus = QaItem['status']
export type QaTeamSummary = components['schemas']['QaTeamSummary']
export type QaAgent = components['schemas']['QaAgentResponse']
export type QaHistoryEvent = components['schemas']['QaHistoryEvent']
export type QaAgentStats = components['schemas']['QaAgentStats']
export type QaStats = components['schemas']['QaStatsResponse']

/** The API's limit on notes. */
export const QA_NOTE_MAX = 2000

/** An agent's id, `none` for sales nobody has yet, or null for all. */
export type QaAssigneeFilter = string | null

export const QA_STATUSES: QaStatus[] = ['open', 'disputed', 'resolve_dispute', 'closed']

export const QA_STATUS_LABEL: Record<QaStatus, string> = {
  open: 'Open',
  disputed: 'Disputed',
  resolve_dispute: 'Resolve Dispute',
  closed: 'Closed',
}

export const QA_STATUS_TONE: Record<QaStatus, 'neutral' | 'red' | 'amber' | 'done'> = {
  open: 'neutral',
  disputed: 'red',
  resolve_dispute: 'amber',
  closed: 'done',
}

/** The lowest and highest score an agent can give. */
export const QA_SCORE_MIN = 0
export const QA_SCORE_MAX = 100

export type QaMove = { to: QaStatus; label: string }

/**
 * What this user can do next with a sale, and what each button says. The
 * assigned agent closes or disputes an open one, and only a Super Admin resolves
 * a dispute. Closed and Resolve Dispute are both final. The API enforces the same.
 */
export function movesFor(roles: readonly Role[], item: QaItem, userId: string | null): QaMove[] {
  if (item.status === 'open' && roles.includes('qa_agent') && item.assignee_user_id === userId) {
    return [
      { to: 'disputed', label: 'Dispute' },
      { to: 'closed', label: 'Close' },
    ]
  }
  if (item.status === 'disputed' && roles.includes('super_admin')) {
    return [{ to: 'resolve_dispute', label: 'Resolve dispute' }]
  }
  return []
}

/** A QA Agent with no wider role sees only the open sales assigned to them. */
export function reviewsOwnOnly(roles: readonly Role[]): boolean {
  return !roles.some((role) => role === 'super_admin' || role === 'qa_manager')
}

export function canAssign(roles: readonly Role[]): boolean {
  return roles.includes('super_admin') || roles.includes('qa_manager')
}

/**
 * Every agent a sale can go to, plus whoever has it now even if they are no
 * longer one, so the picker never shows a sale as unassigned when it is not.
 */
export function assigneeOptions(agents: QaAgent[], item: QaItem): QaAgent[] {
  const current = item.assignee_user_id
  if (!current || agents.some((agent) => agent.user_id === current)) return agents
  return [...agents, { user_id: current, name: item.assignee_name ?? 'Unknown' }]
}

async function json<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<T>
}

/** One page of sales to review, the longest waiting first. A QA Agent only ever gets their own. */
export function listQaItems(
  {
    teamId,
    status,
    assignee,
    limit,
    offset,
  }: {
    teamId: string | null
    status: QaStatus | null
    assignee: QaAssigneeFilter
    limit: number
    offset: number
  },
  token: string
): Promise<QaItemList> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (teamId) params.set('team_id', teamId)
  if (status) params.set('status', status)
  if (assignee) params.set('assignee', assignee)
  return json<QaItemList>(`/qa/items?${params}`, token)
}

/** The sale, its lead's details and each cart, masked. */
export function getQaItem(interactionId: string, token: string): Promise<QaItemDetail> {
  return json<QaItemDetail>(`/qa/items/${encodeURIComponent(interactionId)}`, token)
}

/** Each team's sales by status, for a QA Manager or Super Admin. */
export async function getQaSummary(token: string): Promise<QaTeamSummary[]> {
  return (await json<{ teams: QaTeamSummary[] }>('/qa/summary', token)).teams
}

/** The active QA Agents a sale can go to. */
export async function listQaAgents(token: string): Promise<QaAgent[]> {
  return (await json<{ items: QaAgent[] }>('/qa/agents', token)).items
}

/** Give an open sale to a QA Agent, or to nobody. */
export function assignQaItem(
  interactionId: string,
  assigneeUserId: string | null,
  token: string
): Promise<QaItem> {
  return json<QaItem>(`/qa/items/${encodeURIComponent(interactionId)}/assignee`, token, {
    method: 'PUT',
    body: JSON.stringify({ assignee_user_id: assigneeUserId }),
  })
}

/**
 * Move the sale's review. The agent's notes and score go with a close or a
 * dispute; blank notes are sent as none, and a dispute is resolved with neither.
 */
export function setQaStatus(
  interactionId: string,
  status: QaStatus,
  review: { note: string; score: number | null } | null,
  token: string
): Promise<QaItem> {
  const body = review ? { status, note: review.note.trim() || null, score: review.score } : { status }
  return json<QaItem>(`/qa/items/${encodeURIComponent(interactionId)}/status`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/**
 * What each QA Agent reviewed between two business days, counted in the user's
 * own zone. An agent gets only their own row.
 */
export function getQaStats(range: { start: string; end: string }, token: string): Promise<QaStats> {
  const params = new URLSearchParams({ start: range.start, end: range.end })
  return json<QaStats>(`/qa/stats?${params}`, token)
}
