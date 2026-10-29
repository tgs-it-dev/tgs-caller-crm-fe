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

/** The API's limit on a reason. */
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

/** Where each status may move next, and what its button says. The API enforces the same. */
const QA_MOVES: Record<QaStatus, { to: QaStatus; label: string }[]> = {
  open: [
    { to: 'disputed', label: 'Dispute' },
    { to: 'closed', label: 'Close' },
  ],
  disputed: [{ to: 'resolve_dispute', label: 'Resolve dispute' }],
  resolve_dispute: [{ to: 'closed', label: 'Close' }],
  closed: [],
}

/** A QA Agent with no wider role reviews only their own sales, and moves them only while open. */
export function reviewsOwnOnly(roles: readonly Role[]): boolean {
  return !roles.some((role) => role === 'super_admin' || role === 'qa_manager' || role === 'qa_lead')
}

export function canAssign(roles: readonly Role[]): boolean {
  return roles.includes('super_admin') || roles.includes('qa_lead')
}

/**
 * The agents a sale can go to: its team's, plus whoever has it now even if they
 * are no longer one, so the picker never shows a sale as unassigned when it is not.
 */
export function assigneeOptions(agents: QaAgent[], item: QaItem): QaAgent[] {
  const onTeam = agents.filter((agent) => agent.team_id === item.team_id)
  const current = item.assignee_user_id
  if (!current || onTeam.some((agent) => agent.user_id === current)) return onTeam
  return [...onTeam, { user_id: current, name: item.assignee_name ?? 'Unknown', team_id: item.team_id }]
}

export function movesFor(roles: readonly Role[], status: QaStatus) {
  if (reviewsOwnOnly(roles) && status !== 'open') return []
  return QA_MOVES[status]
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

/** The sale and everything recorded on its lead, with the cart masked. */
export function getQaItem(interactionId: string, token: string): Promise<QaItemDetail> {
  return json<QaItemDetail>(`/qa/items/${encodeURIComponent(interactionId)}`, token)
}

/** Each team's sales by status: every team for a QA Manager, a QA Lead's own. */
export async function getQaSummary(token: string): Promise<QaTeamSummary[]> {
  return (await json<{ teams: QaTeamSummary[] }>('/qa/summary', token)).teams
}

/** The active QA Agents a sale can go to; every team's unless one is named. */
export async function listQaAgents(token: string, teamId: string | null = null): Promise<QaAgent[]> {
  const query = teamId ? `?team_id=${encodeURIComponent(teamId)}` : ''
  return (await json<{ items: QaAgent[] }>(`/qa/agents${query}`, token)).items
}

/** Give the sale to a QA Agent on its team, or to nobody. */
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

/** Move the sale's review, with the reason for it; a blank reason is sent as none. */
export function setQaStatus(
  interactionId: string,
  status: QaStatus,
  note: string,
  token: string
): Promise<QaItem> {
  return json<QaItem>(`/qa/items/${encodeURIComponent(interactionId)}/status`, token, {
    method: 'PUT',
    body: JSON.stringify({ status, note: note.trim() || null }),
  })
}
