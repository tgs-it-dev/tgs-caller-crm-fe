'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import {
  CircleCheck,
  CircleDot,
  Scale,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { Select } from '@/components/ui/Select'
import { StatCard } from '@/components/ui/StatCard'
import { AuthError, type Role } from '@/lib/auth'
import { formatDateTime, formatPhone } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import {
  QA_STATUSES,
  QA_STATUS_LABEL,
  QA_STATUS_TONE,
  assignQaItem,
  assigneeOptions,
  canAssign,
  getQaSummary,
  listQaAgents,
  listQaItems,
  reviewsOwnOnly,
  type QaAgent,
  type QaAssigneeFilter,
  type QaItem,
  type QaItemList,
  type QaStatus,
  type QaTeamSummary,
} from '@/lib/qa'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

const PAGE_SIZE = 20
const NOBODY = 'none'

type ItemsLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: QaItemList }

type CountKey = 'unassigned' | QaStatus
type Counts = Record<CountKey, number>

/** In the order the work goes: hand it out, review it, settle disputes, done. */
const TILES: {
  key: CountKey
  label: string
  icon: LucideIcon
  // The icon's colour while there is any; grey at zero.
  tone: string
}[] = [
  { key: 'unassigned', label: 'Unassigned', icon: UserPlus, tone: tokens.status.gold },
  { key: 'open', label: 'Open', icon: CircleDot, tone: tokens.navy },
  { key: 'disputed', label: 'Disputed', icon: TriangleAlert, tone: tokens.status.red },
  { key: 'resolve_dispute', label: 'Resolve Dispute', icon: Scale, tone: tokens.status.gold },
  { key: 'closed', label: 'Closed', icon: CircleCheck, tone: tokens.slate },
]

function sum(teams: QaTeamSummary[]): Counts {
  const counts: Counts = { unassigned: 0, open: 0, disputed: 0, resolve_dispute: 0, closed: 0 }
  for (const team of teams) {
    for (const key of Object.keys(counts) as CountKey[]) counts[key] += team[key]
  }
  return counts
}

/** A lead with no name is listed by its phone number, which reads better formatted. */
function leadLabel(name: string) {
  return /^\+?[\d\s()-]+$/.test(name) ? formatPhone(name) : name
}

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  if (err instanceof AuthError && err.status === 422) return err.message
  return fallback
}

function overviewColumns(pick: (teamId: string) => void): DataColumn<QaTeamSummary>[] {
  return [
    {
      id: 'team',
      header: 'Team',
      render: (team) => (
        <button
          type="button"
          onClick={() => pick(team.team_id)}
          className="font-medium text-navy hover:underline"
        >
          {team.team_name}
        </button>
      ),
    },
    ...TILES.map(({ key, label }) => ({
      id: key,
      header: label,
      align: 'right' as const,
      render: (team: QaTeamSummary) => <span className="tabular-nums">{team[key]}</span>,
    })),
  ]
}

/**
 * The QA queue. A QA Manager or Super Admin sees every team with an overview of
 * each; a QA Lead sees their team and assigns its sales; a QA Agent sees only the
 * sales assigned to them.
 */
export function QaQueueScreen({ itemHref }: { itemHref: string }) {
  const { user } = useCurrentUser()
  const roles: Role[] = user?.roles ?? []
  const own = reviewsOwnOnly(roles)
  const overview = roles.includes('super_admin') || roles.includes('qa_manager')
  const assigner = canAssign(roles)

  const [teams, setTeams] = useState<QaTeamSummary[]>([])
  const [agents, setAgents] = useState<QaAgent[]>([])
  const [teamId, setTeamId] = useState<string | null>(null)
  const [status, setStatus] = useState<QaStatus | null>(null)
  const [assignee, setAssignee] = useState<QaAssigneeFilter>(null)
  const [offset, setOffset] = useState(0)
  const [tick, setTick] = useState(0)
  const [load, setLoad] = useState<ItemsLoad>({ status: 'loading' })
  const [saving, setSaving] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  // A QA Lead lands on what still needs handing out, decided once the counts arrive.
  const [landed, setLanded] = useState(overview || own)
  const decided = useRef(overview || own)

  // A QA Agent may not read the counts or the agents list, so never asks.
  useEffect(() => {
    if (own) return
    let cancelled = false
    waitForMocking()
      .then(() => withSession((token) => Promise.all([getQaSummary(token), listQaAgents(token)])))
      .then(([summary, people]) => {
        if (cancelled) return
        setTeams(summary)
        setAgents(people)
        if (!decided.current) {
          decided.current = true
          if (sum(summary).unassigned > 0) setAssignee(NOBODY)
          setLanded(true)
        }
      })
      .catch(() => {
        if (cancelled) return
        setProblem('Could not load the team counts.')
        // Without the counts there is nothing to choose a landing from: show everything.
        decided.current = true
        setLanded(true)
      })
    return () => {
      cancelled = true
    }
  }, [own, tick])

  useEffect(() => {
    if (!landed) return
    let cancelled = false
    waitForMocking()
      .then(() =>
        withSession((token) =>
          listQaItems({ teamId, status, assignee, limit: PAGE_SIZE, offset }, token)
        )
      )
      .then((page) => {
        // Only the newest request lands, so a slow answer never replaces a newer one.
        if (!cancelled) setLoad({ status: 'ready', page })
      })
      .catch((err) => {
        if (!cancelled) {
          setLoad({ status: 'error', message: messageFor(err, 'Could not load the sales to review.') })
        }
      })
    return () => {
      cancelled = true
    }
  }, [landed, teamId, status, assignee, offset, tick])

  function pickTeam(next: string | null) {
    setTeamId(next)
    // An agent from another team would match nothing there.
    if (assignee !== NOBODY) setAssignee(null)
    setOffset(0)
  }

  // A tile is selected when the filters are exactly what it would set.
  const view: CountKey | null =
    assignee === NOBODY && !status ? 'unassigned' : !assignee && status ? status : null

  function chooseView(next: CountKey) {
    if (view === next) {
      setStatus(null)
      setAssignee(null)
    } else if (next === 'unassigned') {
      setStatus(null)
      setAssignee(NOBODY)
    } else {
      setStatus(next)
      setAssignee(null)
    }
    setOffset(0)
  }

  function assign(item: QaItem, next: string) {
    setSaving(item.interaction_id)
    setProblem(null)
    withSession((token) => assignQaItem(item.interaction_id, next || null, token))
      .then(() => setTick((n) => n + 1))
      .catch((err) => setProblem(messageFor(err, 'Could not assign that sale. Try again.')))
      .finally(() => setSaving(null))
  }

  const agentsOn = (id: string | null) =>
    id ? agents.filter((agent) => agent.team_id === id) : agents
  const counts = sum(teamId ? teams.filter((team) => team.team_id === teamId) : teams)

  const columns: DataColumn<QaItem>[] = [
    {
      id: 'lead',
      header: 'Lead',
      render: (item) => <span className="font-medium text-ink">{leadLabel(item.lead_name)}</span>,
    },
    ...(overview
      ? [
          {
            id: 'team',
            header: 'Team',
            render: (item: QaItem) => item.team_name,
          } satisfies DataColumn<QaItem>,
        ]
      : []),
    {
      id: 'sold',
      header: 'Sold',
      render: (item) => (
        <>
          <span className="whitespace-nowrap">{formatDateTime(item.closer_outcome_at)}</span>
          <span className="mt-1 block text-xs text-slate">{item.closer_outcome}</span>
        </>
      ),
    },
    { id: 'closer', header: 'Closer', render: (item) => item.closer_name },
    {
      id: 'status',
      header: 'Status',
      render: (item) => (
        <Badge tone={QA_STATUS_TONE[item.status]}>{QA_STATUS_LABEL[item.status]}</Badge>
      ),
    },
    // An agent's own list would repeat their name on every row.
    ...(own
      ? []
      : [
          {
            id: 'assignee',
            header: 'Assigned to',
            // A closed sale needs nobody, so it is never handed out again.
            render: (item: QaItem) =>
              assigner && item.status !== 'closed' ? (
                <div className="w-[180px]">
                  <Select
                    size="small"
                    aria-label={`Assign ${leadLabel(item.lead_name)}`}
                    value={item.assignee_user_id ?? ''}
                    disabled={saving === item.interaction_id}
                    onChange={(event) => assign(item, event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {assigneeOptions(agents, item).map((agent) => (
                      <option key={agent.user_id} value={agent.user_id}>
                        {agent.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <span className={item.assignee_name ? '' : 'text-slate'}>
                  {item.assignee_name ?? '-'}
                </span>
              ),
          } satisfies DataColumn<QaItem>,
        ]),
    {
      id: 'open',
      header: '',
      align: 'right',
      render: (item) => (
        <MuiButton
          component={Link}
          href={`${itemHref}/?id=${encodeURIComponent(item.interaction_id)}`}
          variant="outlined"
          size="small"
        >
          Open<span className="sr-only"> {leadLabel(item.lead_name)}</span>
        </MuiButton>
      ),
    },
  ]

  const page = load.status === 'ready' ? load.page : null
  const ownTeam = !overview && !own ? teams[0] : undefined

  return (
    <PageShell title={ownTeam ? `QA · ${ownTeam.team_name}` : 'QA'}>
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {problem && <Alert>{problem}</Alert>}
        {load.status === 'error' && <Alert>{load.message}</Alert>}

        {!own && teams.length > 0 && (
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-5"
            role="toolbar"
            aria-label="Sales by review status"
          >
            {TILES.map(({ key, label, icon: Icon, tone }) => (
              <StatCard
                key={key}
                label={label}
                count={counts[key]}
                icon={<Icon color={counts[key] > 0 ? tone : tokens.slate} strokeWidth={2} aria-hidden />}
                selected={view === key}
                onClick={() => chooseView(key)}
              />
            ))}
          </div>
        )}

        {overview && teams.length > 0 && (
          <DataTable
            title="Teams"
            ariaLabel="Each team's sales by review status"
            rows={teams}
            columns={overviewColumns(pickTeam)}
            getRowId={(team) => team.team_id}
            emptyMessage="No teams yet."
            paginate={false}
          />
        )}

        <DataTable
          title={own ? 'Assigned to me' : 'Sales to review'}
          ariaLabel={own ? 'The sales assigned to you' : 'Sales to review'}
          toolbar={
            <div className="flex flex-wrap items-end gap-3">
              {overview && (
                <div className="w-[200px]">
                  <Select
                    label="Team"
                    value={teamId ?? ''}
                    onChange={(event) => pickTeam(event.target.value || null)}
                  >
                    <option value="">All teams</option>
                    {teams.map((team) => (
                      <option key={team.team_id} value={team.team_id}>
                        {team.team_name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="w-[200px]">
                <Select
                  label="Status"
                  value={status ?? ''}
                  onChange={(event) => {
                    setStatus((event.target.value || null) as QaStatus | null)
                    setOffset(0)
                  }}
                >
                  <option value="">All statuses</option>
                  {QA_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {QA_STATUS_LABEL[value]}
                    </option>
                  ))}
                </Select>
              </div>
              {!own && (
                <div className="w-[200px]">
                  <Select
                    label="Assigned to"
                    value={assignee ?? ''}
                    onChange={(event) => {
                      setAssignee(event.target.value || null)
                      setOffset(0)
                    }}
                  >
                    <option value="">Anyone</option>
                    <option value={NOBODY}>Unassigned</option>
                    {agentsOn(teamId).map((agent) => (
                      <option key={agent.user_id} value={agent.user_id}>
                        {agent.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          }
          rows={page?.items ?? []}
          columns={columns}
          getRowId={(item) => item.interaction_id}
          emptyMessage={
            load.status === 'loading'
              ? 'Loading sales…'
              : own
                ? 'Nothing is assigned to you right now.'
                : view === 'unassigned'
                  ? 'Every open sale has someone reviewing it.'
                  : 'No sales match these filters.'
          }
          paginate={false}
          paging={
            page
              ? {
                  total: page.total,
                  limit: page.limit,
                  offset: page.offset,
                  onOffsetChange: setOffset,
                }
              : undefined
          }
          minWidth="max-content"
        />
      </div>
    </PageShell>
  )
}
