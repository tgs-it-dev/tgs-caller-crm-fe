'use client'

import { useState } from 'react'
import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import { CircleCheck, Download, SearchX, TriangleAlert } from 'lucide-react'
import { LeadSummaryDialog } from '@/components/admin/LeadSummaryDialog'
import { MarkPaidPanel } from '@/components/admin/MarkPaidPanel'
import { PaidUploadsSection } from '@/components/admin/PaidUploadsSection'
import { PolicyFileDrop } from '@/components/admin/PolicyFileDrop'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { StatCard } from '@/components/ui/StatCard'
import { AuthError, isSuperAdmin } from '@/lib/auth'
import { displayTimeZone, formatDateTime, formatMoney, formatPhone } from '@/lib/format'
import {
  downloadText,
  formatMonth,
  lookupPolicies,
  markPaid,
  policyResultCsv,
  skippedReason,
  type PaidUpload,
  type PolicyLookup,
  type PolicyNumberRow,
  type PolicySale,
  type PolicySkipped,
} from '@/lib/policies'
import { POLICY_STATUS_LABEL, POLICY_STATUS_TONE } from '@/lib/retention'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

const PAGE_SIZE = 20
const NOT_A_LIST = 'Upload a CSV or Excel (.xlsx) file.'

type View = 'matched' | 'unmatched' | 'skipped'
/** A lookup, the file it read, and the upload it was saved as once marked Paid. */
type Result = { lookup: PolicyLookup; file: File; saved: PaidUpload | null }

/**
 * The last lookup, kept in memory while the app is open, so coming back from a
 * lead shows the same results and can still be marked Paid. A reload clears it,
 * and nothing is stored on disk. It is only ever shown to the user who ran it:
 * signing out does not reload.
 */
const lastLookup: { userId: string | null; result: Result | null; view: View } = {
  userId: null,
  result: null,
  view: 'matched',
}

/** A Super Admin gets the amounts and Open, to the lead's full view; a Team Admin gets Summary. */
function matchedColumns(
  superAdmin: boolean,
  onSummary: (sale: PolicySale) => void
): DataColumn<PolicySale>[] {
  return [
    {
      id: 'policy',
      header: 'Policy',
      render: (sale) => <span className="font-medium text-ink">{sale.policy_number}</span>,
    },
    {
      id: 'lead',
      header: 'Lead',
      render: (sale) => (
        <>
          <span className="text-ink">{sale.lead_name}</span>
          <span className="mt-1 block whitespace-nowrap text-xs text-slate">
            {formatPhone(sale.lead_phone)}
          </span>
        </>
      ),
    },
    ...(superAdmin
      ? [{ id: 'team', header: 'Team', render: (sale: PolicySale) => sale.team_name }]
      : []),
    { id: 'closer', header: 'Closer', render: (sale) => sale.closer_name },
    {
      id: 'sold',
      header: 'Sold',
      render: (sale) => <span className="whitespace-nowrap">{formatDateTime(sale.sold_at)}</span>,
    },
    ...(superAdmin
      ? (['total_payment', 'down_payment', 'monthly_payment'] as const).map((key) => ({
          id: key,
          header: key === 'total_payment' ? 'Total' : key === 'down_payment' ? 'Down' : 'Monthly',
          align: 'right' as const,
          render: (sale: PolicySale) => {
            const amount = sale[key]
            return <span className="tabular-nums">{amount ? formatMoney(amount) : '-'}</span>
          },
        }))
      : []),
    {
      id: 'paid',
      header: 'Paid',
      render: (sale) =>
        sale.paid_month ? (
          <span className="whitespace-nowrap">{formatMonth(sale.paid_month, 'short')}</span>
        ) : (
          <span className="whitespace-nowrap text-slate">Not paid</span>
        ),
    },
    {
      id: 'policy_status',
      header: 'Policy status',
      render: (sale) =>
        sale.policy_status ? (
          <Badge tone={POLICY_STATUS_TONE[sale.policy_status]}>
            {POLICY_STATUS_LABEL[sale.policy_status]}
          </Badge>
        ) : (
          <span className="text-slate">-</span>
        ),
    },
    {
      id: 'open',
      header: '',
      align: 'right',
      render: (sale) =>
        superAdmin ? (
          <MuiButton
            component={Link}
            href={`/admin/reports/lead/?id=${encodeURIComponent(sale.lead_id)}&from=policies`}
            variant="outlined"
            size="small"
          >
            Open<span className="sr-only"> {sale.lead_name}</span>
          </MuiButton>
        ) : (
          <MuiButton variant="outlined" size="small" onClick={() => onSummary(sale)}>
            Summary<span className="sr-only"> {sale.lead_name}</span>
          </MuiButton>
        ),
    },
  ]
}

const UNMATCHED_COLUMNS: DataColumn<PolicyNumberRow>[] = [
  { id: 'row', header: 'Row', render: (row) => <span className="tabular-nums">{row.row}</span> },
  { id: 'policy', header: 'Policy', render: (row) => row.policy_number },
]

const SKIPPED_COLUMNS: DataColumn<PolicySkipped>[] = [
  { id: 'row', header: 'Row', render: (row) => <span className="tabular-nums">{row.row}</span> },
  { id: 'value', header: 'Value', render: (row) => <span className="break-all">{row.value}</span> },
  { id: 'why', header: 'Why', render: (row) => skippedReason(row) },
]

/**
 * Upload a list of policy numbers and see the sale behind each, and whether it is
 * Paid. A Super Admin then marks the matches Paid for a month, and keeps the
 * history of those uploads. A Team Admin only looks up, finding only their own
 * team's sales, with no amounts and no download; the API reads another team's as
 * not found.
 */
export function PolicyLookupScreen() {
  const { user } = useCurrentUser()
  const superAdmin = Boolean(user && isSuperAdmin(user.roles))

  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  // The result keeps the name of the file it came from, which may since have changed.
  const mine = Boolean(user && lastLookup.userId === user.id)
  const [result, setResult] = useState<Result | null>(mine ? lastLookup.result : null)
  const [view, setView] = useState<View>(mine ? lastLookup.view : 'matched')
  const [summaryOf, setSummaryOf] = useState<PolicySale | null>(null)
  const [uploadsKey, setUploadsKey] = useState(0)
  // Each fresh start of the Mark as Paid step, so it never keeps an earlier month.
  const [markRun, setMarkRun] = useState(0)

  function show(next: View) {
    lastLookup.view = next
    setView(next)
  }

  function pick(picked: File | null) {
    setFailure(null)
    // `accept` only filters the picker, and a dropped file has no filter at all.
    if (picked && !/\.(csv|xlsx)$/i.test(picked.name)) {
      setFile(null)
      setProblem(NOT_A_LIST)
      return
    }
    setFile(picked)
    setProblem(null)
  }

  function keep(next: Result) {
    lastLookup.userId = user?.id ?? null
    lastLookup.result = next
    setResult(next)
  }

  function lookUp() {
    if (!file) return
    const looked = file
    setBusy(true)
    setProblem(null)
    setFailure(null)
    withSession((token) => lookupPolicies(looked, token))
      .then((lookup) => {
        keep({ lookup, file: looked, saved: null })
        setMarkRun((n) => n + 1)
        show('matched')
      })
      .catch((err) => {
        // The API names the file when it cannot read it; that goes under the upload.
        if (err instanceof AuthError && err.fields.some((field) => field.field === 'file')) {
          setProblem(err.message)
        } else {
          setFailure('Could not look those numbers up. Try again.')
        }
      })
      .finally(() => setBusy(false))
  }

  /** Saves the lookup's file for the month, then reads it again so its Paid column is current. */
  async function markAsPaid(month: string) {
    if (!result) return
    const marked = result
    const saved = await withSession((token) => markPaid(marked.file, month, token))
    setUploadsKey((n) => n + 1)
    // Saved either way: a failed read only leaves the Paid column as it was.
    const lookup = await withSession((token) => lookupPolicies(marked.file, token)).catch(
      () => marked.lookup
    )
    keep({ lookup, file: marked.file, saved })
  }

  /** An undone upload changes paid months, so the lookup on screen is read again. */
  function undone(upload: PaidUpload) {
    const current = lastLookup.result
    if (!current || !mine) return
    const saved = current.saved?.id === upload.id ? null : current.saved
    if (saved !== current.saved) setMarkRun((n) => n + 1)
    withSession((token) => lookupPolicies(current.file, token))
      .then((lookup) => keep({ lookup, file: current.file, saved }))
      .catch(() => keep({ ...current, saved }))
  }

  function download() {
    if (!result) return
    const stem = result.file.name.replace(/\.(csv|xlsx)$/i, '')
    downloadText(`${stem}-results.csv`, policyResultCsv(result.lookup))
  }

  const summary = result?.lookup.summary
  const tiles: { view: View; label: string; count: number; icon: typeof CircleCheck; tone: string }[] =
    summary
      ? [
          { view: 'matched', label: 'Matched', count: summary.matched, icon: CircleCheck, tone: tokens.status.bayGreen },
          { view: 'unmatched', label: 'Not found', count: summary.unmatched, icon: SearchX, tone: tokens.status.red },
          { view: 'skipped', label: 'Skipped', count: summary.skipped, icon: TriangleAlert, tone: tokens.status.gold },
        ]
      : []

  return (
    <PageShell title="Policy lookup">
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {failure && <Alert>{failure}</Alert>}

        <section className="rounded-xl border-hairline border-slate bg-white p-5">
          <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b-hairline border-light-grey pb-3">
            <h2 className="text-base font-semibold leading-[120%] text-ink">
              Upload policy numbers
            </h2>
            <a
              href="/policies-template.csv"
              download
              className="text-xs font-medium text-navy underline hover:text-black"
            >
              Download template
            </a>
          </header>
          <PolicyFileDrop
            file={file}
            hint="One policy number per row. Up to 5,000 rows and 1 MB."
            actionLabel="Look up"
            busyLabel="Looking up…"
            busy={busy}
            problem={problem}
            onPick={pick}
            onClear={() => setFile(null)}
            onAction={lookUp}
          />
        </section>

        {result && summary && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-[120%] text-ink">Results</h2>
                <p className="mt-1 truncate text-sm text-slate">
                  {result.file.name} · {summary.rows.toLocaleString()} policy{' '}
                  {summary.rows === 1 ? 'number' : 'numbers'} read
                </p>
              </div>
              {superAdmin && (
                <MuiButton
                  variant="outlined"
                  size="small"
                  onClick={download}
                  startIcon={<Download className="h-4 w-4" strokeWidth={2} aria-hidden />}
                >
                  Download results
                </MuiButton>
              )}
            </div>

            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              role="toolbar"
              aria-label="Lookup results"
            >
              {tiles.map(({ view: tileView, label, count, icon: Icon, tone }) => (
                <StatCard
                  key={tileView}
                  label={label}
                  count={count}
                  icon={<Icon color={count > 0 ? tone : tokens.slate} strokeWidth={2} aria-hidden />}
                  selected={view === tileView}
                  onClick={() => show(tileView)}
                />
              ))}
            </div>

            {superAdmin && (result.saved || result.lookup.matches.length > 0) && (
              <MarkPaidPanel
                // A new lookup, or undoing what it saved, starts the step afresh.
                key={markRun}
                matches={result.lookup.matches}
                saved={result.saved}
                onMark={markAsPaid}
              />
            )}

            {view === 'matched' && (
              <DataTable
                title="Matched sales"
                ariaLabel="The sales found for the uploaded policy numbers"
                rows={result.lookup.matches}
                columns={matchedColumns(superAdmin, setSummaryOf)}
                getRowId={(sale) => `${sale.row}-${sale.interaction_id}`}
                emptyMessage="None of these policy numbers matched a sale."
                pageSize={PAGE_SIZE}
                minWidth="max-content"
              />
            )}
            {view === 'unmatched' && (
              <DataTable
                title="Not found"
                ariaLabel="Policy numbers with no sale found"
                rows={result.lookup.unmatched}
                columns={UNMATCHED_COLUMNS}
                getRowId={(row) => String(row.row)}
                emptyMessage="Every policy number matched a sale."
                pageSize={PAGE_SIZE}
              />
            )}
            {view === 'skipped' && (
              <DataTable
                title="Skipped"
                ariaLabel="Rows left out of the lookup, and why"
                rows={result.lookup.skipped}
                columns={SKIPPED_COLUMNS}
                getRowId={(row) => String(row.row)}
                emptyMessage="No rows were skipped."
                pageSize={PAGE_SIZE}
              />
            )}
          </section>
        )}

        {superAdmin && <PaidUploadsSection reloadKey={uploadsKey} onUndone={undone} />}
      </div>

      {summaryOf && (
        <LeadSummaryDialog
          key={summaryOf.lead_id}
          lead={{ ...summaryOf, stage: summaryOf.paid_month ? 'paid' : 'sold' }}
          timeZone={displayTimeZone()}
          onClose={() => setSummaryOf(null)}
        />
      )}
    </PageShell>
  )
}
