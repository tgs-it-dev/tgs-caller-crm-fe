'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MuiButton from '@mui/material/Button'
import { ExceptionEvidence } from '@/components/admin/ExceptionEvidence'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { AuthError } from '@/lib/auth'
import {
  listExceptions,
  NOTE_LIMIT,
  reasonLabel,
  resolveException,
  type ExceptionList,
  type ReconciliationException,
  type ResolutionFilter,
} from '@/lib/exceptions'
import { formatDateTime, formatInstant, localZoneName } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'
import { listUsers } from '@/lib/users'

const PAGE_LIMIT = 10

/** The slice on screen, and where in it. */
type Query = { resolution: ResolutionFilter; offset: number }

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: ExceptionList }

const SLICES: { value: ResolutionFilter; label: string }[] = [
  { value: 'open', label: 'Outstanding' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'any', label: 'All' },
]

/** Ties the Review button to the panel it opens, for a reader who can't see it. */
const panelId = (exceptionId: string) => `exception-panel-${exceptionId}`

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403) return 'You no longer have access to exceptions.'
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  return 'Could not load the exception queue.'
}

export function ExceptionsScreen() {
  const [query, setQuery] = useState<Query>({ resolution: 'open', offset: 0 })
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  // Bumped to read the same page again — after resolving a row, or reopening one.
  const [reloads, setReloads] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Only used to name whoever resolved a row. Without it the row says when, not who.
  const [names, setNames] = useState<Record<string, string>>({})

  /** Read a different slice. The rows on screen answered the old one. */
  const select = (next: Query) => {
    setQuery(next)
    setLoad({ status: 'loading' })
    setExpandedId(null)
  }

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => listExceptions({ limit: PAGE_LIMIT, ...query }, token)))
      .then((list) => {
        if (cancelled) return

        // The page emptied under us — the last row on it was resolved out of
        // this slice. Step back rather than leave a reader on a page with no
        // rows and no footer to leave by.
        if (list.items.length === 0 && list.total > 0 && query.offset > 0) {
          select({ ...query, offset: Math.max(0, query.offset - PAGE_LIMIT) })
          return
        }

        setLoad({ status: 'ready', list })
      })
      // Rows never outlive the access that allowed them.
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [query, reloads])

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession(listUsers))
      .then((roster) => {
        if (!cancelled) {
          setNames(Object.fromEntries(roster.items.map((user) => [user.id, user.name])))
        }
      })
      // A name is a courtesy on this screen, not the record. The resolution
      // itself is already on the row, and the audit trail has the actor.
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  const columns: DataColumn<ReconciliationException>[] = [
    {
      id: 'interaction',
      header: 'Interaction',
      render: (row) => (
        <span className="whitespace-nowrap font-mono text-xs text-black">
          {row.interaction_id}
        </span>
      ),
    },
    { id: 'issue', header: 'Issue', render: (row) => reasonLabel(row.reason) },
    {
      id: 'detected',
      // The zone is named once beside the title, not ten times down the column.
      header: 'Detected',
      render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.detected_at)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      // Green for Open, per the design. Resolved falls to neutral so the two
      // still read apart at a glance.
      render: (row) =>
        row.resolved_at ? <Badge>Resolved</Badge> : <Badge tone="done">Open</Badge>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (row) => {
        const open = row.id === expandedId
        return (
          <div className="ml-auto w-[104px]">
            <Button
              size="small"
              variant="secondary"
              aria-expanded={open}
              aria-controls={open ? panelId(row.id) : undefined}
              onClick={() => setExpandedId(open ? null : row.id)}
            >
              {open ? 'Hide' : 'Review'}
              <span className="sr-only"> {reasonLabel(row.reason)}</span>
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <PageShell title="Exceptions Queue">
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading exceptions…
        </p>
      )}

      {load.status === 'error' && <Alert>{load.message}</Alert>}

      {load.status === 'ready' && (
        <DataTable
          title="Unreconciled Interactions"
          ariaLabel="Unreconciled interactions"
          rows={load.list.items}
          columns={columns}
          getRowId={(row) => row.id}
          // Ids and timestamps that must not wrap; the card scrolls if a
          // viewport is too narrow to hold them.
          minWidth="max-content"
          emptyMessage={
            query.resolution === 'open'
              ? 'Nothing outstanding — the last sweep found no mismatches to review.'
              : 'No exceptions in this view.'
          }
          paging={{
            total: load.list.total,
            limit: load.list.limit,
            offset: load.list.offset,
            onOffsetChange: (offset) => select({ ...query, offset }),
          }}
          expandedRowId={expandedId}
          renderExpanded={(row) => (
            <ExceptionRow
              exception={row}
              resolvedByName={row.resolved_by ? names[row.resolved_by] : undefined}
              onChanged={() => {
                setLoad({ status: 'loading' })
                setReloads((count) => count + 1)
              }}
            />
          )}
          actions={
            <div className="flex items-center gap-4">
              <span className="whitespace-nowrap text-xs leading-[150%] text-slate">
                Times in {localZoneName()}
              </span>
              <div className="w-[170px]">
                <Select
                  label="Show"
                  size="small"
                  value={query.resolution}
                  onChange={(event) =>
                    select({ resolution: event.target.value as ResolutionFilter, offset: 0 })
                  }
                >
                  {SLICES.map((slice) => (
                    <option key={slice.value} value={slice.value}>
                      {slice.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          }
        />
      )}
    </PageShell>
  )
}

/** The evidence, a way into the interaction, and the one decision to record. */
function ExceptionRow({
  exception,
  resolvedByName,
  onChanged,
}: {
  exception: ReconciliationException
  resolvedByName: string | undefined
  onChanged: () => void
}) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolvedAt = exception.resolved_at

  const submit = (nextResolved: boolean) => {
    setSaving(true)
    setError(null)

    withSession((token) =>
      resolveException(
        exception.id,
        // The note only travels with a resolution: reopening clears it.
        nextResolved ? { resolved: true, note: note.trim() || null } : { resolved: false },
        token
      )
    )
      .then(onChanged)
      .catch((err) => {
        setSaving(false)
        setError(
          err instanceof AuthError && err.status === 403
            ? 'You no longer have access to resolve exceptions.'
            : 'Could not record that. Please try again.'
        )
      })
  }

  return (
    // One panel, inset and on its own ground, so it reads as hanging off the
    // row above rather than as loose content dropped between two rows.
    <div id={panelId(exception.id)} className="my-1 rounded-xl bg-shop-floor p-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <ExceptionEvidence exception={exception} />

          {/* A link, not a button, because it navigates — but it is the way out
              of this row and has to look like the control it is. Our Button
              wrapper renders a <button>, so this borrows MUI's outlined style
              directly rather than faking it in Tailwind. */}
          <MuiButton
            component={Link}
            href={`/admin/interactions/${exception.interaction_id}?from=exceptions`}
            variant="outlined"
            size="small"
          >
            Open interaction detail
          </MuiButton>
        </div>

        <div className="rounded-lg border-hairline border-slate bg-white p-4">
          {error && <Alert>{error}</Alert>}

          {resolvedAt ? (
            <>
              <h3 className="text-sm font-medium leading-[150%] text-ink">Resolved</h3>
              <p className="mt-1 text-sm leading-[150%] text-body-text">
                {resolvedByName ? `${resolvedByName} · ` : ''}
                {formatInstant(resolvedAt)}
              </p>
              {exception.resolution_note && (
                <p className="mt-3 border-l-2 border-light-grey pl-3 text-sm leading-[150%] text-ink">
                  {exception.resolution_note}
                </p>
              )}
              <div className="mt-4">
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={saving}
                  loadingText="Reopening…"
                  onClick={() => submit(false)}
                >
                  Reopen
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-medium leading-[150%] text-ink">Resolve</h3>
              <div className="mt-3">
                <Textarea
                  label="Note (optional)"
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={NOTE_LIMIT}
                  placeholder="What you found, and what you did about it."
                />
              </div>
              <div className="mt-3">
                <Button
                  size="small"
                  isLoading={saving}
                  loadingText="Saving…"
                  onClick={() => submit(true)}
                >
                  Mark resolved
                </Button>
              </div>
              {/* A mismatch like this cannot heal on its own, so the sweep leaves
                  a resolved row alone rather than flagging it again every 5
                  minutes. Sat under the button, which is what it qualifies. */}
              <p className="mt-2 text-xs leading-[150%] text-slate">
                Records that somebody looked at this, not that it went away.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
