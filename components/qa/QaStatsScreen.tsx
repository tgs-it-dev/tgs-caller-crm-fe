'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, ClipboardCheck, TriangleAlert } from 'lucide-react'
import { DateRangePicker } from '@/components/admin/DateRangePicker'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { StatTile } from '@/components/fronter/StatTile'
import { Alert } from '@/components/ui/Alert'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { Segmented } from '@/components/ui/Segmented'
import { AuthError } from '@/lib/auth'
import { formatDayRange, formatZone } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { getQaStats, reviewsOwnOnly, type QaAgentStats, type QaStats } from '@/lib/qa'
import { businessDay, monthToDate, weekToDate, type DateRange } from '@/lib/reporting'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

type Preset = 'today' | 'week' | 'month'
type Period = Preset | 'custom'

const PRESETS: readonly { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]
// Agents check their own day; comparing agents over any stretch is the QA Manager's.
const WITH_CUSTOM: readonly { value: Period; label: string }[] = [
  ...PRESETS,
  { value: 'custom', label: 'Custom' },
]

/** The business days a preset covers, through today in the user's zone. */
function rangeOf(preset: Preset): DateRange {
  if (preset === 'week') return weekToDate()
  if (preset === 'month') return monthToDate()
  const today = businessDay(new Date())
  return { start: today, end: today }
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; report: QaStats }

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Could not load QA stats for this period.'
}

/** How many were reviewed and how they ended. No score: that grades the closer, not the agent. */
type Figures = Pick<QaAgentStats, 'reviewed' | 'closed' | 'disputed'>

/** Every listed agent's figures added up: an agent's own, or the whole QA team's. */
function totalOf(agents: QaAgentStats[]): Figures {
  return agents.reduce(
    (sum, agent) => ({
      reviewed: sum.reviewed + agent.reviewed,
      closed: sum.closed + agent.closed,
      disputed: sum.disputed + agent.disputed,
    }),
    { reviewed: 0, closed: 0, disputed: 0 }
  )
}

/** Disputed as a share of reviewed, rounded; null when nothing was reviewed. */
function disputedShare(figures: Figures): number | null {
  return figures.reviewed ? Math.round((figures.disputed / figures.reviewed) * 100) : null
}

/** The period's figures as tiles: an agent's own, or every agent's together. */
function Tiles({ figures }: { figures: Figures }) {
  const share = disputedShare(figures)
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      <StatTile
        label="Reviewed"
        value={figures.reviewed}
        icon={<ClipboardCheck strokeWidth={2} aria-hidden />}
      />
      <StatTile
        label="Closed"
        value={figures.closed}
        icon={<CircleCheck strokeWidth={2} aria-hidden />}
      />
      <StatTile
        label="Disputed"
        value={figures.disputed}
        detail={share === null ? undefined : `${share}% of reviewed`}
        icon={<TriangleAlert strokeWidth={2} aria-hidden />}
      />
    </div>
  )
}

/** A table row: an agent, or every agent together under them. */
type Row = Figures & { id: string; name: string }

const TOTAL_ID = 'total'

/** Most reviewed first, then the total when there is more than one agent to add up. */
function rowsOf(report: QaStats): Row[] {
  const agents = report.agents
    .map((agent) => ({ ...agent, id: agent.user_id }))
    .sort((a, b) => b.reviewed - a.reviewed || a.name.localeCompare(b.name))
  if (agents.length < 2) return agents
  return [...agents, { ...totalOf(report.agents), id: TOTAL_ID, name: 'All agents' }]
}

function rowSx(row: Row) {
  if (row.id === TOTAL_ID) return { backgroundColor: tokens.strip, '& td': { fontWeight: 600 } }
  // Two classes, so it beats the colour the table sets on every body cell.
  if (row.reviewed === 0) return { '& td.MuiTableCell-root': { color: tokens.slate } }
  return undefined
}

const COLUMNS: DataColumn<Row>[] = [
  { id: 'agent', header: 'Agent', width: '30%', render: (row) => row.name },
  {
    id: 'reviewed',
    header: 'Reviewed',
    align: 'right',
    render: (row) => <span className="tabular-nums">{row.reviewed}</span>,
  },
  {
    id: 'closed',
    header: 'Closed',
    align: 'right',
    render: (row) => <span className="tabular-nums">{row.closed}</span>,
  },
  {
    id: 'disputed',
    header: 'Disputed',
    align: 'right',
    render: (row) => {
      const share = disputedShare(row)
      return (
        <span className="tabular-nums">
          {row.disputed}
          {share !== null && <span className="text-slate"> ({share}%)</span>}
        </span>
      )
    },
  },
]

/**
 * What each QA Agent reviewed in a period. An agent sees their own figures as
 * tiles. The QA Manager and Super Admin see every agent's together as tiles,
 * then compare them in a table, over a preset or any days they pick.
 */
export function QaStatsScreen() {
  const { user } = useCurrentUser()
  const own = reviewsOwnOnly(user?.roles ?? [])
  const [period, setPeriod] = useState<Period>('today')
  const [custom, setCustom] = useState<DateRange>(() => rangeOf('today'))
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const { start, end } = period === 'custom' ? custom : rangeOf(period)

  /** The figures on screen answered other days: show loading until the new ones arrive. */
  const reread = (next: DateRange) => {
    if (next.start !== start || next.end !== end) setLoad({ status: 'loading' })
  }

  const choose = (next: Period) => {
    if (next === period) return
    if (next === 'custom') {
      // Custom starts from the days already on screen, so nothing reloads until they change.
      setCustom({ start, end })
    } else {
      reread(rangeOf(next))
    }
    setPeriod(next)
  }

  const pickDays = (next: DateRange) => {
    reread(next)
    setCustom(next)
  }

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => getQaStats({ start, end }, token)))
      .then((report) => {
        if (!cancelled) setLoad({ status: 'ready', report })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [start, end])

  const report = load.status === 'ready' ? load.report : null

  return (
    <PageShell title="QA stats">
      <div className="space-y-5">
        {/* The period beside the days and zone the figures on screen came back for. */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Segmented
              label="Period"
              options={own ? PRESETS : WITH_CUSTOM}
              value={period}
              onChange={choose}
            />
            {period === 'custom' && (
              <DateRangePicker
                range={custom}
                max={businessDay(new Date(), report?.timezone)}
                onChange={pickDays}
              />
            )}
          </div>
          {report && (
            <p className="text-sm leading-[150%] text-slate">
              {formatDayRange(report.start, report.end)} · {formatZone(report.end, report.timezone)}
            </p>
          )}
        </div>
        {load.status === 'error' && <Alert>{load.message}</Alert>}

        {load.status === 'loading' && (
          <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
            Loading QA stats…
          </p>
        )}
        {report && (
          <>
            <Tiles figures={totalOf(report.agents)} />
            {!own && (
              <DataTable
                title="Reviews by agent"
                ariaLabel="What each QA Agent reviewed"
                rows={rowsOf(report)}
                columns={COLUMNS}
                getRowId={(row) => row.id}
                getRowSx={rowSx}
                emptyMessage="No QA Agents yet."
                paginate={false}
                minWidth="max-content"
              />
            )}
            <p className="text-xs leading-[150%] text-slate">
              A review counts on the day the agent closed or disputed the sale.
            </p>
          </>
        )}
      </div>
    </PageShell>
  )
}
