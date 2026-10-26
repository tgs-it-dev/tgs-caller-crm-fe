'use client'

import { useEffect, useState } from 'react'
import { DateRangePicker } from '@/components/admin/DateRangePicker'
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

/** A team's figures, or every team's added up under them. */
type Row = TeamFigures & { id: string; name: string }

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
  return teams.length > 1 ? [...teams, { ...report.total, id: 'total', name: 'All teams' }] : teams
}

function conversion(row: Row) {
  if (row.conversion_rate === null) return formatPercent(null)
  return `${formatPercent(row.conversion_rate)} (${row.converted} of ${row.leads})`
}

const COMPARISON: DataColumn<Row>[] = [
  { id: 'team', header: 'Team', render: (row) => row.name },
  { id: 'leads', header: 'Leads', align: 'right', render: (row) => row.leads },
  { id: 'qualified', header: 'Qualified', align: 'right', render: (row) => row.qualified },
  { id: 'transferred', header: 'Transferred', align: 'right', render: (row) => row.transferred },
  { id: 'sales', header: 'Sales', align: 'right', render: (row) => row.sales },
  { id: 'conversion', header: 'Conversion', align: 'right', render: conversion },
]

/** One column per fronter outcome in the reply, which lists the same outcomes on every row. */
function outcomeColumns(report: TeamStatsReport): DataColumn<Row>[] {
  return [
    { id: 'team', header: 'Team', render: (row) => row.name },
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
        <section className="rounded-xl border-hairline border-slate bg-white p-5">
          <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b-hairline border-light-grey pb-4">
            <div>
              <h2 className="text-lg font-medium leading-[120%] text-ink">Team comparison</h2>
              {load.status === 'ready' && (
                // The window and zone the figures on screen came back for.
                <p className="mt-1 text-sm leading-[120%] text-slate">
                  {formatDayRange(load.report.start, load.report.end)} ·{' '}
                  {formatZone(load.report.end, load.report.timezone)}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-[168px]">
                <Select
                  size="small"
                  value={selected.teamId}
                  aria-label="Filter by team"
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
          </header>

          {load.status === 'loading' && (
            <p className="py-10 text-center text-sm text-slate">Loading team stats…</p>
          )}
          {load.status === 'error' && <Alert>{load.message}</Alert>}
          {load.status === 'ready' && (
            <>
              <DataTable
                embedded
                title="Team comparison"
                ariaLabel="Figures by team"
                rows={rows}
                columns={COMPARISON}
                getRowId={(row) => row.id}
                emptyMessage="No teams to show."
                pageSize={Math.max(rows.length, 1)}
              />
              <p className="mt-4 text-sm leading-[140%] text-slate">
                Sales counts every sale made during these dates. Conversion is the share of these
                dates&apos; leads that have been sold, whenever the sale happened.
              </p>
            </>
          )}
        </section>

        {load.status === 'ready' && (
          <DataTable
            title="Fronter outcomes"
            ariaLabel="Fronter outcomes by team"
            // No outcome columns means nothing was recorded, which the empty message says.
            rows={load.report.total.outcomes.length > 0 ? rows : []}
            columns={outcomeColumns(load.report)}
            getRowId={(row) => row.id}
            emptyMessage="No fronter outcomes were recorded during these dates."
            pageSize={Math.max(rows.length, 1)}
            minWidth="max-content"
          />
        )}
      </div>
    </PageShell>
  )
}
