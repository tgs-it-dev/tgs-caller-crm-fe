'use client'

import { useState } from 'react'
import { BadgeCheck, CircleX, FileSpreadsheet, PhoneCall, Repeat, UserPlus } from 'lucide-react'
import { PolicyFileDrop } from '@/components/admin/PolicyFileDrop'
import {
  NOT_A_FILE,
  NoteList,
  ProblemList,
  TemplateLink,
  fileMessage,
  isSpreadsheet,
} from '@/components/dataUpload/UploadParts'
import { StatTile } from '@/components/fronter/StatTile'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import {
  checkAgentWork,
  uploadAgentWork,
  type AgentWorkCheck,
  type AgentWorkTeam,
  type DateOrder,
} from '@/lib/dataImports'
import { formatDay } from '@/lib/format'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

const COLUMN_HELP: readonly [string, string, string][] = [
  ['Date', 'When an agent is named', 'The day it was worked: an Excel date or 2026-11-03. No time.'],
  ['Team', 'Lead-only rows', 'Usually empty: it comes from the agent.'],
  ['Phone', 'Yes', 'Any format: (212) 555-0100, 212.555.0100, +1 212 555 0100.'],
  ['First name to Notes', 'No', 'The lead and form details: names, vehicle, VIN, plate, notes.'],
  ['Fronter, Fronter outcome', 'Together', 'Callback or Transferred.'],
  [
    'Closer, Closer outcome',
    'After Transferred, or alone',
    'Sale, Not Qualified, Price Objection, Callback Scheduled, Transfer Dropped, Do Not Call. With no Fronter, the row is the closer’s Own Sale.',
  ],
  [
    'Payment and card',
    'On a Sale',
    'Policy number, the three amounts and the account number; routing and expiry optional. Only on a Sale or a Callback Scheduled.',
  ],
]

const TH = 'px-3 py-2.5 text-left text-xs font-medium text-body-text whitespace-nowrap'
const TD = 'px-3 py-2.5 text-sm text-ink whitespace-nowrap'
const NUM = `${TD} text-right tabular-nums`

function closerOutcomeLabels(teams: AgentWorkTeam[]): string[] {
  const labels = new Set<string>()
  for (const team of teams) for (const closer of team.closers) Object.keys(closer.outcomes).forEach((l) => labels.add(l))
  return [...labels].filter((label) => label !== 'Sale').sort()
}

function TeamNumbers({ team, labels, open }: { team: AgentWorkTeam; labels: string[]; open: boolean }) {
  return (
    <details className="overflow-hidden rounded-xl border-hairline border-slate bg-white" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3">
        <span className="text-base font-semibold text-ink">{team.team}</span>
        <span className="text-xs text-slate">
          {team.fronters.length} {team.fronters.length === 1 ? 'fronter' : 'fronters'} · {team.closers.length}{' '}
          {team.closers.length === 1 ? 'closer' : 'closers'}
        </span>
      </summary>
      <div className="grid border-t-hairline border-light-grey xl:grid-cols-[2fr_3fr]">
        <div className="overflow-x-auto border-light-grey xl:border-r-hairline">
          <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-slate">
            Fronters, as Agent stats will show them
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-hairline border-slate">
                <th className={TH}>Fronter</th>
                <th className={`${TH} text-right`}>Qualifications</th>
                <th className={`${TH} text-right`}>Transfers</th>
                <th className={`${TH} text-right`}>Callbacks</th>
              </tr>
            </thead>
            <tbody>
              {team.fronters.map((f) => (
                <tr key={f.username} className="border-b-hairline border-light-grey even:bg-table-strip">
                  <td className={TD}>{f.name}</td>
                  <td className={NUM}>{f.qualifications}</td>
                  <td className={NUM}>{f.transfers}</td>
                  <td className={NUM}>{f.callbacks}</td>
                </tr>
              ))}
              {team.fronters.length === 0 && (
                <tr>
                  <td className={`${TD} text-slate`} colSpan={4}>
                    No fronter rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-slate">Closers</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-hairline border-slate">
                <th className={TH}>Closer</th>
                <th className={`${TH} text-right`}>Sold</th>
                <th className={`${TH} text-right`}>Own Sales</th>
                <th className={`${TH} text-right`}>Transfers taken</th>
                {labels.map((label) => (
                  <th key={label} className={`${TH} text-right`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.closers.map((c) => (
                <tr key={c.username} className="border-b-hairline border-light-grey even:bg-table-strip">
                  <td className={TD}>{c.name}</td>
                  <td className={`${NUM} font-semibold`}>{c.sold}</td>
                  <td className={NUM}>{c.own_sales}</td>
                  <td className={NUM}>{c.transfers_taken}</td>
                  {labels.map((label) => (
                    <td key={label} className={NUM}>
                      {c.outcomes[label] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
              {team.closers.length === 0 && (
                <tr>
                  <td className={`${TD} text-slate`} colSpan={4 + labels.length}>
                    No closer rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}

function DateBars({ check }: { check: AgentWorkCheck }) {
  const dates = check.dates
  if (dates.length === 0) return null
  const most = Math.max(...dates.map((d) => d.rows))
  const first = dates[0].day
  const last = dates[dates.length - 1].day
  return (
    <section className="rounded-xl border-hairline border-slate bg-white p-5">
      <h3 className="text-sm font-semibold text-ink">
        Dates found: {formatDay(first)}
        {first !== last && ` to ${formatDay(last)}`}
      </h3>
      <p className="mt-0.5 text-xs text-slate">
        Rows per date. If these look a month off, switch the date order above and check again.
      </p>
      <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-1">
        {dates.map((d) => (
          <div key={d.day} className="flex min-w-[56px] flex-1 flex-col items-center gap-1">
            <span className="text-xs tabular-nums text-body-text">{d.rows.toLocaleString()}</span>
            <div
              className="w-full rounded-t bg-status-blue/70"
              style={{ height: `${Math.max(4, Math.round((d.rows / most) * 80))}px` }}
            />
            <span className="whitespace-nowrap text-[11px] text-slate">{formatDay(d.day)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

type Checked = { check: AgentWorkCheck; file: File; order: DateOrder }

export function AgentWorkUploadTab({ onUploaded }: { onUploaded: () => void }) {
  const [order, setOrder] = useState<DateOrder>('mdy')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [checked, setChecked] = useState<Checked | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ name: string; summary: Record<string, number> } | null>(null)

  function pick(picked: File | null) {
    setFailure(null)
    if (picked && !isSpreadsheet(picked)) {
      setFile(null)
      setProblem(NOT_A_FILE)
      return
    }
    setFile(picked)
    setProblem(null)
    setChecked(null)
  }

  function check() {
    if (!file) return
    const sent = file
    const sentOrder = order
    setBusy(true)
    setProblem(null)
    setFailure(null)
    setDone(null)
    withSession((token) => checkAgentWork(sent, sentOrder, token))
      .then((result) => setChecked({ check: result, file: sent, order: sentOrder }))
      .catch((err) => {
        const message = fileMessage(err)
        if (message) setProblem(message)
        else setFailure('Could not check that file. Try again.')
      })
      .finally(() => setBusy(false))
  }

  function upload() {
    if (!checked) return
    setSaving(true)
    withSession((token) => uploadAgentWork(checked.file, checked.order, token))
      .then((item) => {
        setDone({ name: checked.file.name, summary: item.summary as Record<string, number> })
        setChecked(null)
        setFile(null)
        onUploaded()
      })
      .catch((err) => {
        setFailure(fileMessage(err) ?? 'That did not save. Check the file again and retry.')
      })
      .finally(() => {
        setSaving(false)
        setConfirming(false)
      })
  }

  const result = checked?.check
  const totals = result?.totals
  const problems = result ? result.problem_count : 0
  const labels = result ? closerOutcomeLabels(result.teams) : []

  return (
    <div className="flex flex-col gap-5">
      {failure && <Alert>{failure}</Alert>}
      <section className="rounded-xl border-hairline border-slate bg-white p-5">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b-hairline border-light-grey pb-3">
          <h2 className="text-base font-semibold leading-[120%] text-ink">Upload agent work</h2>
          <TemplateLink kind="agent-work" />
        </header>
        <fieldset className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <legend className="sr-only">How typed dates are written</legend>
          <span className="text-body-text">Typed dates like 03/11/2026 are written as</span>
          {(['mdy', 'dmy'] as const).map((value) => (
            <label key={value} className="flex items-center gap-1.5 text-ink">
              <input
                type="radio"
                name="date-order"
                checked={order === value}
                onChange={() => {
                  setOrder(value)
                  setChecked(null)
                }}
              />
              {value === 'mdy' ? 'MM/DD/YYYY' : 'DD/MM/YYYY'}
            </label>
          ))}
          <span className="text-xs text-slate">Excel dates and 2026-11-03 are read the same either way.</span>
        </fieldset>
        <PolicyFileDrop
          file={file}
          hint="One row per lead worked on one day. Up to 20,000 rows and 10 MB; split a longer period into files by date."
          actionLabel="Check"
          busyLabel="Checking…"
          busy={busy}
          problem={problem}
          onPick={pick}
          onClear={() => {
            setFile(null)
            setChecked(null)
          }}
          onAction={check}
        />
        <p className="mt-3 text-xs text-slate">
          The file holds card numbers. Delete it from your computer once it&apos;s uploaded.
        </p>
        <details className="mt-4 rounded-lg border-hairline border-light-grey">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-navy">What goes in each column</summary>
          <div className="overflow-x-auto border-t-hairline border-light-grey">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-hairline border-slate">
                  <th className={TH}>Column</th>
                  <th className={TH}>Needed</th>
                  <th className={TH}>What to put</th>
                </tr>
              </thead>
              <tbody>
                {COLUMN_HELP.map(([column, needed, what]) => (
                  <tr key={column} className="border-b-hairline border-light-grey">
                    <td className={`${TD} font-medium`}>{column}</td>
                    <td className={TD}>{needed}</td>
                    <td className="px-3 py-2.5 text-sm text-ink">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t-hairline border-light-grey px-4 py-2.5 text-xs text-slate">
            <strong className="font-semibold text-ink">No Fronter = the closer’s Own Sale.</strong> The one
            exception: if that same closer already has an open Callback Scheduled on the lead, the row is
            them working that callback, on the same call. The template’s How to fill sheet has the full list.
          </p>
        </details>
      </section>

      {done && (
        <section className="flex items-start gap-3 rounded-xl border-hairline border-slate bg-white p-5" aria-live="polite">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" color={tokens.status.bayGreen} strokeWidth={2} aria-hidden />
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-[120%] text-ink">
              Uploaded {(done.summary.rows ?? 0).toLocaleString()} rows from {done.name}
            </h2>
            <p className="mt-1 text-sm leading-[150%] text-body-text">
              {(done.summary.leads ?? 0).toLocaleString()} new leads, {(done.summary.calls ?? 0).toLocaleString()} calls,{' '}
              {(done.summary.transfers ?? 0).toLocaleString()} transfers and {(done.summary.sales ?? 0).toLocaleString()}{' '}
              sales. They now show in Agent stats, Team stats, the Callbacks lists and QA.
            </p>
            <p className="mt-1 text-sm text-slate">Undo is on Past uploads, until anyone works on what was uploaded.</p>
          </div>
        </section>
      )}

      {checked && result && totals && (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-[120%] text-ink">Check</h2>
                <p className="mt-1 truncate text-sm text-slate">
                  {checked.file.name}
                  {result.sheet ? ` (sheet "${result.sheet}")` : ''} · {totals.rows.toLocaleString()} rows read.
                  Nothing is saved yet.
                </p>
              </div>
              <div className="w-[240px]">
                <Button
                  type="button"
                  size="small"
                  disabled={problems > 0 || totals.rows === 0}
                  onClick={() => setConfirming(true)}
                >
                  {problems > 0 ? 'Fix the problems to import' : `Import ${totals.rows.toLocaleString()} rows`}
                </Button>
              </div>
            </div>
            {result.already_uploaded && <Alert>{result.already_uploaded}</Alert>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatTile label="Rows" value={totals.rows.toLocaleString()} icon={<FileSpreadsheet color={tokens.navy} aria-hidden />} />
              <StatTile label="New leads" value={totals.new_leads.toLocaleString()} icon={<UserPlus color={tokens.status.bayGreen} aria-hidden />} />
              <StatTile label="Calls" value={totals.calls.toLocaleString()} icon={<PhoneCall color={tokens.status.blue} aria-hidden />} />
              <StatTile label="Transfers" value={totals.transfers.toLocaleString()} icon={<Repeat color={tokens.status.gold} aria-hidden />} />
              <StatTile
                label="Problems"
                value={problems.toLocaleString()}
                icon={<CircleX color={problems > 0 ? tokens.status.red : tokens.slate} aria-hidden />}
              />
            </div>
            <p className="text-sm text-body-text">
              {totals.sales.toLocaleString()} sales ({totals.own_sales.toLocaleString()} Own Sales) ·{' '}
              {totals.existing_leads.toLocaleString()} leads already in the CRM · {totals.lead_only.toLocaleString()}{' '}
              {totals.lead_only === 1 ? 'lead' : 'leads'} with no agent yet
            </p>
          </section>
          <DateBars check={result} />
          <ProblemList problems={result.problems} />
          {result.problem_count > result.problems.length && (
            <p className="-mt-3 text-xs text-slate">
              Showing the first {result.problems.length.toLocaleString()} of {result.problem_count.toLocaleString()} problems.
            </p>
          )}
          <NoteList notes={result.notes} />
          {result.teams.map((team, index) => (
            <TeamNumbers key={team.team} team={team} labels={labels} open={index < 2} />
          ))}
        </>
      )}

      <Dialog
        open={confirming}
        title="Import agent work"
        onClose={() => setConfirming(false)}
        busy={saving}
        actions={
          <div className="flex w-full gap-3">
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={upload} isLoading={saving} loadingText="Importing…">
              Import
            </Button>
          </div>
        }
      >
        {totals && (
          <div className="space-y-2 text-sm leading-[150%] text-body-text">
            <p className="font-medium text-ink">Import {totals.rows.toLocaleString()} rows?</p>
            <p>
              The leads, calls, transfers and sales go in as they happened, on their own dates. Undo stays
              available until anyone works on them. The file is checked again as it saves.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
