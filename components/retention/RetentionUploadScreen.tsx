'use client'

import { useState } from 'react'
import { BadgeCheck, CircleCheck, CircleMinus, SearchX, TriangleAlert, XCircle } from 'lucide-react'
import { PolicyFileDrop } from '@/components/admin/PolicyFileDrop'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { PageShell } from '@/components/ui/PageShell'
import { StatCard } from '@/components/ui/StatCard'
import { AuthError } from '@/lib/auth'
import { skippedReason, type PolicyNumberRow, type PolicySkipped } from '@/lib/policies'
import {
  POLICY_STATUS_LABEL,
  POLICY_STATUS_TONE,
  checkStatusFile,
  saveStatusFile,
  type PolicyStatus,
  type RetentionInvalidRow,
  type RetentionUploadCheck,
  type RetentionUploadRow,
} from '@/lib/retention'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

const PAGE_SIZE = 20
const NOT_A_FILE = 'Upload a CSV or Excel (.xlsx) file.'

type View = 'changes' | 'unchanged' | 'unmatched' | 'invalid' | 'skipped'
type Checked = { check: RetentionUploadCheck; file: File }

function changesText(count: number) {
  return `${count.toLocaleString()} status ${count === 1 ? 'change' : 'changes'}`
}

function StatusCell({ status }: { status: PolicyStatus | null }) {
  return status ? (
    <Badge tone={POLICY_STATUS_TONE[status]}>{POLICY_STATUS_LABEL[status]}</Badge>
  ) : (
    <span className="text-slate">No status</span>
  )
}

const ROW: DataColumn<{ row: number }> = {
  id: 'row',
  header: 'Row',
  render: (row) => <span className="tabular-nums">{row.row}</span>,
}

const CHANGE_COLUMNS: DataColumn<RetentionUploadRow>[] = [
  ROW,
  {
    id: 'policy',
    header: 'Policy',
    render: (row) => <span className="font-medium text-ink">{row.policy_number}</span>,
  },
  { id: 'from', header: 'Now', render: (row) => <StatusCell status={row.current_status} /> },
  { id: 'to', header: 'In the file', render: (row) => <StatusCell status={row.status} /> },
]

const UNMATCHED_COLUMNS: DataColumn<PolicyNumberRow>[] = [
  ROW,
  { id: 'policy', header: 'Policy', render: (row) => row.policy_number },
]

const INVALID_COLUMNS: DataColumn<RetentionInvalidRow>[] = [
  ROW,
  { id: 'policy', header: 'Policy', render: (row) => row.policy_number },
  {
    id: 'status',
    header: 'Status in the file',
    render: (row) => (row.status ? row.status : <span className="text-slate">Blank</span>),
  },
]

const SKIPPED_COLUMNS: DataColumn<PolicySkipped>[] = [
  ROW,
  { id: 'value', header: 'Value', render: (row) => <span className="break-all">{row.value}</span> },
  { id: 'why', header: 'Why', render: (row) => skippedReason(row) },
]

/**
 * Upload the carrier's list of policy statuses, see what it would change, then
 * save. Only rows that change a status are saved.
 */
export function RetentionUploadScreen() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [checked, setChecked] = useState<Checked | null>(null)
  const [view, setView] = useState<View>('changes')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ count: number; name: string } | null>(null)

  function pick(picked: File | null) {
    setFailure(null)
    // `accept` only filters the picker, and a dropped file has no filter at all.
    if (picked && !/\.(csv|xlsx)$/i.test(picked.name)) {
      setFile(null)
      setProblem(NOT_A_FILE)
      return
    }
    setFile(picked)
    setProblem(null)
  }

  function check() {
    if (!file) return
    const sent = file
    setBusy(true)
    setProblem(null)
    setFailure(null)
    setSaved(null)
    withSession((token) => checkStatusFile(sent, token))
      .then((result) => {
        setChecked({ check: result, file: sent })
        setView('changes')
      })
      .catch((err) => {
        // The API names the file when it cannot read it; that goes under the upload.
        if (err instanceof AuthError && err.fields.some((field) => field.field === 'file')) {
          setProblem(err.message)
        } else {
          setFailure('Could not check that file. Try again.')
        }
      })
      .finally(() => setBusy(false))
  }

  function save() {
    if (!checked) return
    setSaving(true)
    withSession((token) => saveStatusFile(checked.file, token))
      .then((count) => {
        setSaved({ count, name: checked.file.name })
        setChecked(null)
        setFile(null)
        setConfirming(false)
      })
      .catch(() => {
        setConfirming(false)
        setFailure('That did not save. Try again.')
      })
      .finally(() => setSaving(false))
  }

  const summary = checked?.check.summary
  const tiles: { view: View; label: string; count: number; icon: typeof CircleCheck; tone: string }[] =
    summary
      ? [
          { view: 'changes', label: 'Changes', count: summary.changes, icon: CircleCheck, tone: tokens.status.bayGreen },
          { view: 'unchanged', label: 'No change', count: summary.unchanged, icon: CircleMinus, tone: tokens.slate },
          { view: 'unmatched', label: 'Not found', count: summary.unmatched, icon: SearchX, tone: tokens.status.red },
          { view: 'invalid', label: 'Invalid status', count: summary.invalid, icon: XCircle, tone: tokens.status.red },
          { view: 'skipped', label: 'Skipped', count: summary.skipped, icon: TriangleAlert, tone: tokens.status.gold },
        ]
      : []

  return (
    <PageShell title="Upload statuses">
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {failure && <Alert>{failure}</Alert>}

        <section className="rounded-xl border-hairline border-slate bg-white p-5">
          <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b-hairline border-light-grey pb-3">
            <h2 className="text-base font-semibold leading-[120%] text-ink">
              Upload policy statuses
            </h2>
            <a
              href="/retention-template.csv"
              download
              className="text-xs font-medium text-navy underline hover:text-black"
            >
              Download template
            </a>
          </header>
          <PolicyFileDrop
            file={file}
            hint="A policy number and a status column: Cancelled, Retained or Pending. Up to 5,000 rows and 1 MB."
            actionLabel="Check"
            busyLabel="Checking…"
            busy={busy}
            problem={problem}
            onPick={pick}
            onClear={() => setFile(null)}
            onAction={check}
          />
        </section>

        {saved && (
          <section
            className="flex items-start gap-3 rounded-xl border-hairline border-slate bg-white p-5"
            aria-live="polite"
          >
            <BadgeCheck
              className="mt-0.5 h-5 w-5 shrink-0"
              color={tokens.status.bayGreen}
              strokeWidth={2}
              aria-hidden
            />
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-[120%] text-ink">
                Saved {changesText(saved.count)}
              </h2>
              <p className="mt-1 text-sm leading-[150%] text-slate">From {saved.name}.</p>
            </div>
          </section>
        )}

        {checked && summary && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-[120%] text-ink">Check</h2>
                <p className="mt-1 truncate text-sm text-slate">
                  {checked.file.name} · {summary.rows.toLocaleString()} policy{' '}
                  {summary.rows === 1 ? 'number' : 'numbers'} read. Nothing is saved yet.
                </p>
              </div>
              <div className="w-[200px]">
                <Button
                  type="button"
                  size="small"
                  disabled={summary.changes === 0}
                  onClick={() => setConfirming(true)}
                >
                  {summary.changes === 0 ? 'Nothing to save' : `Save ${changesText(summary.changes)}`}
                </Button>
              </div>
            </div>
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-5"
              role="toolbar"
              aria-label="Rows by what saving does with them"
            >
              {tiles.map(({ view: key, label, count, icon: Icon, tone }) => (
                <StatCard
                  key={key}
                  label={label}
                  count={count}
                  icon={<Icon color={count > 0 ? tone : tokens.slate} strokeWidth={2} aria-hidden />}
                  selected={view === key}
                  onClick={() => setView(key)}
                />
              ))}
            </div>
            {view === 'changes' && (
              <DataTable
                title="Changes"
                ariaLabel="Rows that change a policy's status"
                rows={checked.check.changes}
                columns={CHANGE_COLUMNS}
                getRowId={(row) => String(row.row)}
                emptyMessage="Nothing in this file changes a status."
                pageSize={PAGE_SIZE}
              />
            )}
            {view === 'unchanged' && (
              <DataTable
                title="No change"
                ariaLabel="Rows whose policy is already at that status"
                rows={checked.check.unchanged}
                columns={CHANGE_COLUMNS}
                getRowId={(row) => String(row.row)}
                emptyMessage="No row repeats a status a policy already has."
                pageSize={PAGE_SIZE}
              />
            )}
            {view === 'unmatched' && (
              <DataTable
                title="Not found"
                ariaLabel="Policy numbers no sale carries"
                rows={checked.check.unmatched}
                columns={UNMATCHED_COLUMNS}
                getRowId={(row) => String(row.row)}
                emptyMessage="Every policy number has a sale."
                pageSize={PAGE_SIZE}
              />
            )}
            {view === 'invalid' && (
              <DataTable
                title="Invalid status"
                ariaLabel="Rows whose status is not Cancelled, Retained or Pending"
                rows={checked.check.invalid}
                columns={INVALID_COLUMNS}
                getRowId={(row) => String(row.row)}
                emptyMessage="Every row names Cancelled, Retained or Pending."
                pageSize={PAGE_SIZE}
              />
            )}
            {view === 'skipped' && (
              <DataTable
                title="Skipped"
                ariaLabel="Rows left out of the file"
                rows={checked.check.skipped}
                columns={SKIPPED_COLUMNS}
                getRowId={(row) => String(row.row)}
                emptyMessage="No rows were skipped."
                pageSize={PAGE_SIZE}
              />
            )}
          </section>
        )}
      </div>

      <Dialog
        open={confirming}
        title="Save statuses"
        onClose={() => setConfirming(false)}
        busy={saving}
        actions={
          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} isLoading={saving} loadingText="Saving…">
              Save
            </Button>
          </div>
        }
      >
        {summary && (
          <div className="space-y-2 text-sm leading-[150%] text-body-text">
            <p className="font-medium text-ink">Save {changesText(summary.changes)}?</p>
            <p>
              Each number&apos;s sale gets its new status. Rows that change nothing, are not found
              or have an invalid status are left out. The file is checked again as it saves.
            </p>
          </div>
        )}
      </Dialog>
    </PageShell>
  )
}
