'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import MuiButton from '@mui/material/Button'
import { AgentTargetsDialog } from '@/components/admin/AgentTargetsDialog'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { AgentFigureTiles } from '@/components/stats/AgentFigureTiles'
import { AgentLeadsTable } from '@/components/stats/AgentLeadsTable'
import { AgentSalesTable } from '@/components/stats/AgentSalesTable'
import { PeriodPicker } from '@/components/stats/PeriodPicker'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import {
  fetchAgentStats,
  targetOf,
  type AgentPeriod,
  type AgentStats,
  type AgentStatsReport,
  type PeriodChoice,
} from '@/lib/agentStats'
import { AuthError, isSuperAdmin } from '@/lib/auth'
import { displayTimeZone, formatPercent } from '@/lib/format'
import type { StatsStage } from '@/lib/fronterStats'
import { waitForMocking } from '@/lib/mockReady'
import { businessDay } from '@/lib/reporting'
import { withSession } from '@/lib/session'
import { listTeams, type Team } from '@/lib/teams'
import { listUsers, type User } from '@/lib/users'

const STAGES: readonly { value: StatsStage; label: string }[] = [
  { value: 'fronter', label: 'Fronters' },
  { value: 'closer', label: 'Closers' },
]
const PERIODS: readonly AgentPeriod[] = ['today', 'week', 'month']

type LoadState =
  | { status: 'loading'; previous: AgentStatsReport | null }
  | { status: 'error'; message: string }
  | { status: 'ready'; report: AgentStatsReport }

/** Loading again, keeping the figures last shown so an agent's view stays on screen. */
function reloading(load: LoadState): LoadState {
  if (load.status === 'ready') return { status: 'loading', previous: load.report }
  return { status: 'loading', previous: load.status === 'loading' ? load.previous : null }
}

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403)
    return 'You no longer have access to agent stats.'
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  return 'Could not load agent stats for this period.'
}

function Target({ row }: { row: AgentStats }) {
  const { done, target } = targetOf(row)
  if (target === null) return <span className="text-slate">-</span>
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span aria-hidden className="h-1.5 w-12 overflow-hidden rounded-full bg-light-grey">
        <span
          className="block h-full rounded-full bg-navy"
          style={{ width: `${Math.min(done / target, 1) * 100}%` }}
        />
      </span>
      {done} of {target}
    </span>
  )
}

function columnsFor(
  stage: StatsStage,
  monthly: boolean,
  onView: (row: AgentStats) => void,
  onTargets: (row: AgentStats) => void
): DataColumn<AgentStats>[] {
  const number = (id: string, header: string, value: (row: AgentStats) => number | string) => ({
    id,
    header,
    align: 'right' as const,
    render: (row: AgentStats) => <span className="tabular-nums">{value(row)}</span>,
  })
  const figures: DataColumn<AgentStats>[] =
    stage === 'fronter'
      ? [
          number('qualifications', 'Qualifications', (row) => row.fronter?.qualifications ?? 0),
          number('transfers', 'Transfers', (row) => row.fronter?.transfers ?? 0),
          number('callbacks', 'Callbacks', (row) => row.fronter?.callbacks ?? 0),
        ]
      : [
          number('sold', 'Sold', (row) => row.closer?.sold ?? 0),
          ...(monthly
            ? [
                number('paid', 'Paid', (row) => row.closer?.paid ?? 0),
                number('conversion', 'Conversion', (row) =>
                  formatPercent(row.closer?.conversion_rate ?? null)
                ),
              ]
            : []),
          number('cancelled', 'Cancelled', (row) => row.closer?.cancelled ?? 0),
          number('retained', 'Retained', (row) => row.closer?.retained ?? 0),
          number('pending', 'Pending', (row) => row.closer?.pending ?? 0),
          number('qa', 'Avg QA', (row) => row.closer?.average_qa_score?.toFixed(1) ?? '-'),
        ]
  return [
    {
      id: 'agent',
      header: 'Agent',
      render: (row) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          {row.name}
          {!row.active && <Badge>Inactive</Badge>}
        </span>
      ),
    },
    { id: 'team', header: 'Team', render: (row) => row.team_name ?? '-' },
    ...figures,
    { id: 'target', header: 'Target', render: (row) => <Target row={row} /> },
    {
      id: 'actions',
      header: 'Action',
      align: 'right',
      render: (row) => (
        <span className="inline-flex gap-2">
          <MuiButton variant="outlined" size="small" onClick={() => onView(row)}>
            View<span className="sr-only"> {row.name}</span>
          </MuiButton>
          <MuiButton variant="outlined" size="small" onClick={() => onTargets(row)}>
            Targets<span className="sr-only"> for {row.name}</span>
          </MuiButton>
        </span>
      ),
    },
  ]
}

/**
 * Each fronter's or closer's figures for a day, a week or a month, and one
 * agent's leads and policies. A Team Admin sees their own team, without amounts;
 * a Super Admin every team. The filters live in the URL, so Back from a lead
 * comes back to the same view.
 */
export function AgentStatsScreen() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useCurrentUser()
  const superAdmin = Boolean(user && isSuperAdmin(user.roles))

  const stage: StatsStage = params.get('stage') === 'fronter' ? 'fronter' : 'closer'
  const teamId = superAdmin ? (params.get('team') ?? '') : ''
  const agentId = params.get('agent') ?? ''
  const asked = params.get('period')
  const period: AgentPeriod = PERIODS.includes(asked as AgentPeriod)
    ? (asked as AgentPeriod)
    : 'today'
  const day = params.get('date')
  const choice = useMemo<PeriodChoice>(() => ({ period, day }), [period, day])

  const [load, setLoad] = useState<LoadState>({ status: 'loading', previous: null })
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [targetsOf, setTargetsOf] = useState<AgentStats | null>(null)
  const [reload, setReload] = useState(0)

  // Adjusting state during render, not in an effect, when the filters change.
  const query = params.toString()
  const [shownFor, setShownFor] = useState(query)
  if (shownFor !== query) {
    setShownFor(query)
    setLoad(reloading)
  }

  function update(next: Record<string, string | null>) {
    const merged = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value)
      else merged.delete(key)
    }
    router.replace(`${pathname}?${merged}`, { scroll: false })
  }

  useEffect(() => {
    let cancelled = false
    waitForMocking()
      .then(() =>
        withSession((token) =>
          Promise.all([listUsers(token), superAdmin ? listTeams(token) : null])
        )
      )
      .then(([userList, teamList]) => {
        if (cancelled) return
        setUsers([...userList.items].sort((a, b) => a.name.localeCompare(b.name)))
        if (teamList) setTeams([...teamList.items].sort((a, b) => a.name.localeCompare(b.name)))
      })
      // Without the lists the filters offer "All" only, and the page still works.
      .catch(() => {
        if (!cancelled) setUsers([])
      })
    return () => {
      cancelled = true
    }
  }, [superAdmin])

  useEffect(() => {
    let cancelled = false
    waitForMocking()
      .then(() =>
        withSession((token) =>
          fetchAgentStats(
            { period, day },
            { stage, teamId: teamId || null, agentId: agentId || null },
            token
          )
        )
      )
      .then((report) => {
        if (!cancelled) setLoad({ status: 'ready', report })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })
    return () => {
      cancelled = true
    }
  }, [stage, teamId, agentId, period, day, reload])

  const report = load.status === 'ready' ? load.report : null
  const today = businessDay(new Date(), report?.timezone ?? displayTimeZone())
  const offered = users.filter(
    (person) => person.roles.includes(stage) && (!teamId || person.team_id === teamId)
  )
  // While the next period loads, the agent's view stays, so its tables keep their tab.
  const onScreen = load.status === 'loading' ? load.previous : report
  const picked = agentId
    ? onScreen?.agents.find((row) => row.user_id === agentId && row.stage === stage)
    : undefined

  return (
    <PageShell title="Agent stats">
      <div className="space-y-5">
        <section className="rounded-xl border-hairline border-slate bg-white p-5">
          <div className="flex flex-wrap items-end gap-3">
            {superAdmin && (
              <div className="w-[200px]">
                <Select
                  label="Team"
                  value={teamId}
                  onChange={(event) => update({ team: event.target.value, agent: null })}
                >
                  <option value="">All teams</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="w-[220px]">
              <Select
                label="Agent"
                value={agentId}
                onChange={(event) => update({ agent: event.target.value })}
              >
                <option value="">All {stage === 'fronter' ? 'fronters' : 'closers'}</option>
                {offered.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
            </div>
            <Segmented
              label="Role"
              options={STAGES}
              value={stage}
              onChange={(next) => update({ stage: next, agent: null })}
            />
          </div>
          <div className="mt-4">
            <PeriodPicker
              choice={choice}
              shown={report}
              today={today}
              onChange={(next) => update({ period: next.period, date: next.day })}
            />
          </div>
        </section>

        {load.status === 'loading' && !picked && (
          <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
            Loading agent stats…
          </p>
        )}
        {load.status === 'error' && <Alert>{load.message}</Alert>}

        {report && agentId && !picked && (
          <Alert>This agent has nothing to show in this period, or is not on your team.</Alert>
        )}

        {onScreen && picked && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold leading-[140%] text-ink">{picked.name}</h2>
                <p className="text-sm leading-[150%] text-slate">
                  {picked.team_name ?? 'No team'} · {stage === 'fronter' ? 'Fronter' : 'Closer'}
                </p>
              </div>
              <MuiButton variant="outlined" size="small" onClick={() => setTargetsOf(picked)}>
                Set targets
              </MuiButton>
            </div>
            <div aria-busy={!report} className={report ? undefined : 'opacity-60'}>
              <AgentFigureTiles row={picked} period={onScreen.period} />
            </div>
            <AgentLeadsTable
              userId={picked.user_id}
              stage={stage}
              choice={choice}
              canOpen={superAdmin}
            />
            <AgentSalesTable
              userId={picked.user_id}
              stage={stage}
              choice={choice}
              amounts={superAdmin}
            />
          </>
        )}

        {report && !agentId && (
          <DataTable
            title={stage === 'fronter' ? 'Fronters' : 'Closers'}
            ariaLabel={`Each ${stage}'s figures for the period`}
            toolbar={
              report.period === 'month' || stage === 'fronter' ? undefined : (
                <p className="text-sm leading-[140%] text-slate">
                  Paid and conversion are counted by month, so they show on the Month tab.
                </p>
              )
            }
            rows={report.agents}
            columns={columnsFor(
              stage,
              report.period === 'month',
              (row) => update({ agent: row.user_id }),
              setTargetsOf
            )}
            getRowId={(row) => row.user_id}
            emptyMessage={`No ${stage === 'fronter' ? 'fronters' : 'closers'} to show.`}
            paginate={false}
            minWidth="max-content"
          />
        )}
      </div>

      {targetsOf && (
        <AgentTargetsDialog
          key={targetsOf.user_id}
          agent={targetsOf}
          onClose={() => setTargetsOf(null)}
          onSaved={() => {
            setTargetsOf(null)
            setLoad(reloading)
            setReload((n) => n + 1)
          }}
        />
      )}
    </PageShell>
  )
}
