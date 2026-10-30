'use client'

import { useRef, useState, type DragEvent } from 'react'
import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import { CircleCheck, Download, FileSpreadsheet, SearchX, TriangleAlert, X } from 'lucide-react'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { StatCard } from '@/components/ui/StatCard'
import { AuthError, isSuperAdmin } from '@/lib/auth'
import { formatDateTime, formatMoney, formatPhone } from '@/lib/format'
import {
  downloadText,
  lookupPolicies,
  policyResultCsv,
  skippedReason,
  type PolicyLookup,
  type PolicyNumberRow,
  type PolicySale,
  type PolicySkipped,
} from '@/lib/policies'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

const PAGE_SIZE = 20
const NOT_A_LIST = 'Upload a CSV or Excel (.xlsx) file.'

type View = 'matched' | 'unmatched' | 'skipped'
type Result = { lookup: PolicyLookup; fileName: string }

/**
 * The last lookup, kept in memory while the app is open, so coming back from a
 * lead shows the same results. A reload clears it, and nothing is stored on disk.
 * It is only ever shown to the user who ran it: signing out does not reload.
 */
const lastLookup: { userId: string | null; result: Result | null; view: View } = {
  userId: null,
  result: null,
  view: 'matched',
}

function fileSize(bytes: number) {
  return bytes < 1024 ? `${bytes} bytes` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function matchedColumns(superAdmin: boolean): DataColumn<PolicySale>[] {
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
    ...(['total_payment', 'down_payment', 'monthly_payment'] as const).map((key) => ({
      id: key,
      header: key === 'total_payment' ? 'Total' : key === 'down_payment' ? 'Down' : 'Monthly',
      align: 'right' as const,
      render: (sale: PolicySale) => <span className="tabular-nums">{formatMoney(sale[key])}</span>,
    })),
    // A lead's full view is the Super Admin's alone.
    ...(superAdmin
      ? [
          {
            id: 'open',
            header: '',
            align: 'right' as const,
            render: (sale: PolicySale) => (
              <MuiButton
                component={Link}
                href={`/admin/reports/lead/?id=${encodeURIComponent(sale.lead_id)}&from=policies`}
                variant="outlined"
                size="small"
              >
                Open<span className="sr-only"> {sale.lead_name}</span>
              </MuiButton>
            ),
          },
        ]
      : []),
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
 * Upload a list of policy numbers and see the sale behind each. A Team Admin
 * finds only their own team's sales; the API reads another team's as not found.
 */
export function PolicyLookupScreen() {
  const { user } = useCurrentUser()
  const superAdmin = Boolean(user && isSuperAdmin(user.roles))
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  // The result keeps the name of the file it came from, which may since have changed.
  const mine = Boolean(user && lastLookup.userId === user.id)
  const [result, setResult] = useState<Result | null>(mine ? lastLookup.result : null)
  const [view, setView] = useState<View>(mine ? lastLookup.view : 'matched')

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

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files?.[0] ?? null)
  }

  function lookUp() {
    if (!file) return
    setBusy(true)
    setProblem(null)
    setFailure(null)
    withSession((token) => lookupPolicies(file, token))
      .then((lookup) => {
        lastLookup.userId = user?.id ?? null
        lastLookup.result = { lookup, fileName: file.name }
        setResult(lastLookup.result)
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

  function download() {
    if (!result) return
    const stem = result.fileName.replace(/\.(csv|xlsx)$/i, '')
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
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={(event) => {
              // Moving over the text or buttons inside is not leaving the zone.
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDragging(false)
              }
            }}
            onDrop={drop}
            className={`flex flex-wrap items-center gap-4 rounded-xl border border-dashed px-5 py-5 transition-colors ${
              dragging ? 'border-navy bg-shop-floor' : 'border-light-grey bg-white'
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-shop-floor">
              <FileSpreadsheet className="h-5 w-5" color={tokens.navy} strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1" aria-live="polite">
              {file ? (
                <>
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="shrink-0 text-slate hover:text-ink"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </button>
                  </p>
                  <p className="text-xs leading-[150%] text-slate">{fileSize(file.size)}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-ink">
                    Drop a CSV or Excel file here, or choose one
                  </p>
                  <p className="text-xs leading-[150%] text-slate">
                    One policy number per row. Up to 5,000 rows and 1 MB.
                  </p>
                </>
              )}
            </div>
            <div className="flex shrink-0 gap-3">
              <div className="w-[128px]">
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => inputRef.current?.click()}
                >
                  {file ? 'Change file' : 'Choose file'}
                </Button>
              </div>
              <div className="w-[128px]">
                <Button
                  type="button"
                  size="small"
                  disabled={!file}
                  isLoading={busy}
                  loadingText="Looking up…"
                  onClick={lookUp}
                >
                  Look up
                </Button>
              </div>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const picked = event.target.files?.[0] ?? null
              // Cleared so picking the same file again, once fixed, still registers.
              event.target.value = ''
              pick(picked)
            }}
          />
          {problem && (
            <p role="alert" className="mt-2 text-xs leading-[150%] text-status-red">
              {problem}
            </p>
          )}
        </section>

        {result && summary && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-[120%] text-ink">Results</h2>
                <p className="mt-1 truncate text-sm text-slate">
                  {result.fileName} · {summary.rows.toLocaleString()} policy{' '}
                  {summary.rows === 1 ? 'number' : 'numbers'} read
                </p>
              </div>
              <MuiButton
                variant="outlined"
                size="small"
                onClick={download}
                startIcon={<Download className="h-4 w-4" strokeWidth={2} aria-hidden />}
              >
                Download results
              </MuiButton>
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

            {view === 'matched' && (
              <DataTable
                title="Matched sales"
                ariaLabel="The sales found for the uploaded policy numbers"
                rows={result.lookup.matches}
                columns={matchedColumns(superAdmin)}
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
      </div>
    </PageShell>
  )
}
