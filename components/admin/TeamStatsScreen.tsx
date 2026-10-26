'use client'

import { useEffect, useState } from 'react'
import { CircleDollarSign, Contact, TrendingUp } from 'lucide-react'
import { DateRangePicker } from '@/components/admin/DateRangePicker'
import { StatTile } from '@/components/fronter/StatTile'
import { Alert } from '@/components/ui/Alert'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { Select } from '@/components/ui/Select'
import { AuthError } from '@/lib/auth'
import { formatDayRange, formatPercent, formatZone } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import {
  businessDay,
  fetchTeamStats,
  monthToDate,
  type DateRange,
  type TeamFigures,
  type TeamStatsReport,
} from '@/lib/reporting'
import { withSession } from '@/lib/session'
import { listTeams, type Team } from '@/lib/teams'
import { tokens } from '@/lib/theme'

/** A team's figures, or every team's added up under them. */
type Row = TeamFigures & { id: string; name: string }

const TOTAL_ID = 'total'

/**
 * The window and team the figures should answer, an empty team meaning all of
 * them. No zone: the server counts in the user's own.
 */
type Selection = { range: DateRange; teamId: string }

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; report: TeamStatsReport }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403)
    return 'You no longer have access to team stats.'
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  return 'Could not load team stats for this range.'
}

/** The teams, then their total when there is more than one to add up. */
function rowsOf(report: TeamStatsReport): Row[] {
  const teams = report.teams.map((team) => ({ ...team, id: team.team_id, name: team.team_name }))
  if (teams.length < 2) return teams
  return [...teams, { ...report.total, id: TOTAL_ID, name: 'All teams' }]
}

/** A team with nothing in the range, drawn quieter so the eye goes to the ones with figures. */
function isQuiet(row: Row) {
  return (
    row.id !== TOTAL_ID &&
    row.leads + row.qualified + row.transferred + row.sales === 0 &&
    row.outcomes.every((outcome) => outcome.count === 0)
  )
}

function rowSx(row: Row) {
  if (row.id === TOTAL_ID) return { backgroundColor: tokens.strip, '& td': { fontWeight: 600 } }
  // Two classes, so it beats the colour the table sets on every body cell.
  if (isQuiet(row)) return { '& td.MuiTableCell-root': { color: tokens.slate } }
  return undefined
}

/** The rate first, a bar to compare teams by eye, then the counts it came from. */
function Conversion({ row }: { row: Row }) {
  if (row.conversion_rate === null) return <>{formatPercent(null)}</>
  return (
    <span className="inline-flex items-center gap-3 tabular-nums">
      <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-light-grey">
        <span
          className="block h-full rounded-full bg-navy"
          style={{ width: `${row.conversion_rate * 100}%` }}
        />
      </span>
      <span>{formatPercent(row.conversion_rate)}</span>
      <span className="text-slate">
        {row.converted} of {row.leads}
      </span>
    </span>
  )
}

// The team column takes the slack, so each row's figures sit together.
const TEAM: DataColumn<Row> = {
  id: 'team',
  header: 'Team',
  width: '30%',
  render: (row) => row.name,
}

const COMPARISON: DataColumn<Row>[] = [
  TEAM,
  { id: 'leads', header: 'Leads', align: 'right', render: (row) => row.leads },
  { id: 'qualified', header: 'Qualified', align: 'right', render: (row) => row.qualified },
  { id: 'transferred', header: 'Transferred', align: 'right', render: (row) => row.transferred },
  { id: 'sales', header: 'Sales', align: 'right', render: (row) => row.sales },
  {
    id: 'conversion',
    header: 'Conversion',
    align: 'right',
    render: (row) => <Conversion row={row} />,
  },
]

/** One column per fronter outcome in the reply, which lists the same outcomes on every row. */
function outcomeColumns(report: TeamStatsReport): DataColumn<Row>[] {
  return [
    TEAM,
    ...report.total.outcomes.map(
      (outcome): DataColumn<Row> => ({
        id: outcome.disposition_id,
        header: outcome.label,
        align: 'right',
        render: (row) =>
          row.outcomes.find((theirs) => theirs.disposition_id === outcome.disposition_id)
            ?.count ?? 0,
      })
    ),
  ]
}

export function TeamStatsScreen() {
  const [selected, setSelected] = useState<Selection>(() => ({
    range: monthToDate(),
    teamId: '',
  }))
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [teams, setTeams] = useState<Team[]>([])

  /** Read another window or team. The figures on screen answered the old one. */
  const choose = (next: Partial<Selection>) => {
    setSelected((current) => ({ ...current, ...next }))
    setLoad({ status: 'loading' })
  }

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => listTeams(token)))
      .then((list) => {
        if (!cancelled) setTeams([...list.items].sort((a, b) => a.name.localeCompare(b.name)))
      })
      // Without the list the filter offers all teams only, and the page still works.
      .catch(() => {
        if (!cancelled) setTeams([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession((token) => fetchTeamStats(selected.range, selected.teamId || null, token))
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
  }, [selected])

  const zone = load.status === 'ready' ? load.report.timezone : undefined
  const rows = load.status === 'ready' ? rowsOf(load.report) : []

  return (
    <PageShell title="Team stats">
      <div className="space-y-5">
        {/* The page's own filters, outside any one table, so the sales report can share them. */}
        <section className="rounded-xl border-hairline border-slate bg-white p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[200px]">
              <Select
                label="Team"
                value={selected.teamId}
                onChange={(event) => choose({ teamId: event.target.value })}
              >
                <option value="">All teams</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </div>
            <DateRangePicker
              range={selected.range}
              max={businessDay(new Date(), zone)}
              onChange={(range) => choose({ range })}
            />
          </div>
        </section>

        {load.status === 'loading' && (
          <div className="rounded-xl border-hairline border-slate bg-white px-4 py-10">
            <p className="text-center text-sm text-slate">Loading team stats…</p>
          </div>
        )}
        {load.status === 'error' && <Alert>{load.message}</Alert>}
        {load.status === 'ready' && (
          <>
            <div className="flex flex-col gap-5 sm:flex-row">
              <StatTile
                label="Leads"
                value={load.report.total.leads}
                icon={<Contact strokeWidth={2} aria-hidden />}
              />
              <StatTile
                label="Sales"
                value={load.report.total.sales}
                icon={<CircleDollarSign strokeWidth={2} aria-hidden />}
              />
              <StatTile
                label="Conversion"
                value={formatPercent(load.report.total.conversion_rate)}
                detail={
                  load.report.total.conversion_rate === null
                    ? undefined
                    : `${load.report.total.converted} of ${load.report.total.leads} sold`
                }
                icon={<TrendingUp strokeWidth={2} aria-hidden />}
              />
            </div>

            <DataTable
              title="Team comparison"
              ariaLabel="Figures by team"
              // The window and zone the figures on screen came back for.
              actions={
                <p className="text-sm leading-[120%] text-slate">
                  {formatDayRange(load.report.start, load.report.end)} ·{' '}
                  {formatZone(load.report.end, load.report.timezone)}
                </p>
              }
              toolbar={
                <p className="text-sm leading-[140%] text-slate">
                  Sales counts every sale made during these dates. Conversion is the share of
                  these dates&apos; leads that have been sold, whenever the sale happened.
                </p>
              }
              rows={rows}
              columns={COMPARISON}
              getRowId={(row) => row.id}
              getRowSx={rowSx}
              emptyMessage="No teams to show."
              paginate={false}
              minWidth="max-content"
            />

            <DataTable
              title="Fronter outcomes"
              ariaLabel="Fronter outcomes by team"
              // No outcome columns means nothing was recorded, which the empty message says.
              rows={load.report.total.outcomes.length > 0 ? rows : []}
              columns={outcomeColumns(load.report)}
              getRowId={(row) => row.id}
              getRowSx={rowSx}
              emptyMessage="No fronter outcomes were recorded during these dates."
              paginate={false}
              minWidth="max-content"
            />
          </>
        )}
      </div>
    </PageShell>
  )
}
