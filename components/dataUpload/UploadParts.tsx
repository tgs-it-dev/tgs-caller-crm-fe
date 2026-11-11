'use client'

import { useState } from 'react'
import { CircleX, TriangleAlert } from 'lucide-react'
import { AuthError } from '@/lib/auth'
import { downloadTemplate, type TemplateKind, type UploadNote, type UploadProblem } from '@/lib/dataImports'
import { withSession } from '@/lib/session'
import { tokens } from '@/lib/theme'

export const NOT_A_FILE = 'Upload a CSV or Excel (.xlsx) file.'

export function isSpreadsheet(file: File): boolean {
  // `accept` only filters the picker, and a dropped file has no filter at all.
  return /\.(csv|xlsx)$/i.test(file.name)
}

/** The API names the file when it cannot read it; that message goes under the upload. */
export function fileMessage(err: unknown): string | null {
  return err instanceof AuthError && err.fields.some((field) => field.field === 'file')
    ? err.message
    : null
}

export function TemplateLink({ kind }: { kind: TemplateKind }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <span className="flex items-baseline gap-2">
      {failed && <span className="text-xs text-status-red">Could not download. Try again.</span>}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          setFailed(false)
          withSession((token) => downloadTemplate(kind, token))
            .catch(() => setFailed(true))
            .finally(() => setBusy(false))
        }}
        className="text-xs font-medium text-navy underline hover:text-black disabled:text-slate"
      >
        {busy ? 'Preparing…' : 'Download template'}
      </button>
    </span>
  )
}

export function ProblemList({ problems }: { problems: UploadProblem[] }) {
  if (problems.length === 0) return null
  return (
    <section className="overflow-hidden rounded-xl border-hairline border-slate bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b-hairline border-light-grey px-5 py-3">
        <CircleX className="h-5 w-5 shrink-0" color={tokens.status.red} strokeWidth={2} aria-hidden />
        <h2 className="text-base font-semibold text-ink">Problems ({problems.length.toLocaleString()})</h2>
        <span className="ml-auto text-xs text-slate">
          Fix these rows in the file and check it again. Nothing is saved while there are problems.
        </span>
      </header>
      <ul className="max-h-[480px] divide-y divide-light-grey overflow-y-auto">
        {problems.map((problem, index) => (
          <li key={`${problem.row}-${problem.column}-${index}`} className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3 text-sm">
            <span className="w-24 shrink-0 font-medium tabular-nums text-ink">
              {problem.row ? `Row ${problem.row.toLocaleString()}` : 'File'}
            </span>
            <span className="w-36 shrink-0 text-body-text">{problem.column ?? ''}</span>
            <span className="min-w-0 flex-1 text-ink">{problem.message}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function NoteList({ notes }: { notes: UploadNote[] }) {
  if (notes.length === 0) return null
  return (
    <details className="rounded-xl border-hairline border-slate bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-5 py-3">
        <TriangleAlert className="h-5 w-5 shrink-0" color={tokens.status.gold} strokeWidth={2} aria-hidden />
        <span className="text-base font-semibold text-ink">Notes ({notes.length.toLocaleString()})</span>
        <span className="text-xs text-slate">
          These don&apos;t stop the import. They say what will happen with odd values.
        </span>
      </summary>
      <ul className="divide-y divide-light-grey border-t-hairline border-light-grey">
        {notes.map((note, index) => (
          <li key={index} className="px-5 py-2.5 text-sm text-body-text">
            {note.row ? `Row ${note.row.toLocaleString()}: ` : ''}
            {note.message}
          </li>
        ))}
      </ul>
    </details>
  )
}
