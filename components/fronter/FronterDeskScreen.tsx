'use client'

import { useEffect, useState } from 'react'
import MuiAlert from '@mui/material/Alert'
import MuiButton from '@mui/material/Button'
import { Pencil, Plus, Search } from 'lucide-react'
import { LeadCreateDialog } from '@/components/fronter/LeadCreateDialog'
import { LeadEditDialog } from '@/components/fronter/LeadEditDialog'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Input } from '@/components/ui/Input'
import { PageShell } from '@/components/ui/PageShell'
import { listDispositions } from '@/lib/dispositions'
import { formatDateTime, formatPhone } from '@/lib/format'
import { CALLBACK_DISPOSITION_LABEL } from '@/lib/leadFormDraft'
import {
  leadDisplayName,
  searchLeads,
  type LeadSearch,
  type LeadSearchItem,
} from '@/lib/leads'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

/** A full query on a busy team, so it refreshes less often than the callback list did. */
const POLL_MS = 30_000
const PAGE_SIZE = 10
/** Long enough to wait out a word being typed, short enough to feel live. */
const TYPING_PAUSE_MS = 300

type LeadsLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: LeadSearch }

function noticeForResult(result: {
  next: 'saved' | 'desk' | 'transferred'
  lead: Parameters<typeof leadDisplayName>[0]
  disposition?: { label: string }
  closerName?: string | null
}): string {
  const name = leadDisplayName(result.lead)
  if (result.next === 'transferred') {
    return result.closerName
      ? `${name} offered to ${result.closerName}.`
      : `${name} offered to a closer.`
  }
  if (result.next === 'desk' && result.disposition) {
    return `${name} saved as ${result.disposition.label}.`
  }
  return `${name} saved.`
}

function leadColumns(onEdit: (lead: LeadSearchItem) => void): DataColumn<LeadSearchItem>[] {
  return [
    {
      id: 'lead',
      header: 'Lead',
      render: (lead) => (
        <>
          <span className="font-medium text-ink">{lead.lead_name}</span>
          <span className="mt-1 block text-xs text-slate">{formatPhone(lead.phone_no)}</span>
        </>
      ),
    },
    {
      id: 'added',
      header: 'Added',
      render: (lead) => <span className="whitespace-nowrap">{formatDateTime(lead.created_at)}</span>,
    },
    {
      id: 'disposition',
      header: 'Latest disposition',
      render: (lead) =>
        lead.latest_disposition ? (
          <>
            <span>{lead.latest_disposition}</span>
            {lead.latest_disposition_at && (
              <span className="mt-1 block whitespace-nowrap text-xs text-slate">
                {formatDateTime(lead.latest_disposition_at)}
              </span>
            )}
          </>
        ) : (
          <span className="text-slate">-</span>
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      render: (lead) => (
        <div className="whitespace-nowrap">
          <MuiButton
            size="small"
            variant="outlined"
            color="primary"
            onClick={() => onEdit(lead)}
            startIcon={<Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
            aria-label={`Edit ${lead.lead_name}`}
          >
            Edit
          </MuiButton>
        </div>
      ),
    },
  ]
}

function emptyMessage(searching: boolean) {
  return searching ? 'No callbacks match that search.' : 'No callbacks right now.'
}

/**
 * Fronter home: the team's callbacks, the only leads a fronter works. Searching
 * applies as it is typed; there is no button.
 */
export function FronterDeskScreen() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<LeadSearchItem | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Undefined until the catalogue says which id Callback is, null if it could not.
  const [callbackId, setCallbackId] = useState<string | null | undefined>(undefined)
  const [typed, setTyped] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [tick, setTick] = useState(0)
  const [load, setLoad] = useState<LeadsLoad>({ status: 'loading' })
  // Asked again on each refresh until it answers, so one failed load is not the end.
  const needsCatalogue = typeof callbackId !== 'string'

  useEffect(() => {
    if (!needsCatalogue) return
    let cancelled = false
    waitForMocking()
      .then(() => withSession((token) => listDispositions(token, 'fronter')))
      .then((rows) => {
        if (!cancelled) {
          setCallbackId(rows.find((row) => row.label === CALLBACK_DISPOSITION_LABEL)?.id ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) setCallbackId(null)
      })
    return () => {
      cancelled = true
    }
  }, [needsCatalogue, tick])

  // Waits for a pause in typing, then searches from the first page.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(typed)
      setOffset(0)
    }, TYPING_PAUSE_MS)
    return () => clearTimeout(id)
  }, [typed])

  useEffect(() => {
    if (!callbackId) return
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession((token) =>
          searchLeads({ q: query, disposition: callbackId, limit: PAGE_SIZE, offset }, token)
        )
      )
      .then((page) => {
        // Only the newest request lands, so a slow answer never replaces a newer one.
        if (!cancelled) setLoad({ status: 'ready', page })
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error', message: 'Unable to load callbacks right now.' })
      })

    return () => {
      cancelled = true
    }
  }, [query, callbackId, offset, tick])

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), POLL_MS)
    return () => clearInterval(id)
  }, [])

  const page = load.status === 'ready' ? load.page : null
  const searching = query.trim().length > 0

  return (
    <PageShell
      title="Leads"
      actions={
        <div className="w-[160px]">
          <Button size="small" onClick={() => setCreateOpen(true)}>
            <span className="flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              New lead
            </span>
          </Button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {notice && (
          <MuiAlert severity="success" role="status" onClose={() => setNotice(null)} sx={{ mb: 0 }}>
            {notice}
          </MuiAlert>
        )}
        {load.status === 'error' && <Alert>{load.message}</Alert>}
        {callbackId === null && <Alert>Unable to load callbacks right now.</Alert>}

        <DataTable
          title="Callbacks"
          ariaLabel="The team's callbacks"
          toolbar={
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full max-w-[320px]">
                <Input
                  aria-label="Search by phone or name"
                  placeholder="Search by phone or name"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  startAdornment={<Search className="h-4 w-4 text-slate" strokeWidth={2} aria-hidden />}
                />
              </div>
            </div>
          }
          rows={page?.items ?? []}
          columns={leadColumns((lead) => setEditing(lead))}
          getRowId={(lead) => lead.lead_id}
          emptyMessage={
            callbackId === null
              ? 'No callbacks to show.'
              : load.status === 'loading'
                ? 'Loading callbacks…'
                : emptyMessage(searching)
          }
          paginate={false}
          paging={
            page
              ? {
                  total: page.total,
                  limit: page.limit,
                  offset: page.offset,
                  onOffsetChange: setOffset,
                }
              : undefined
          }
          minWidth="max-content"
        />
      </div>

      {createOpen && (
        <LeadCreateDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(result) => {
            setCreateOpen(false)
            setNotice(noticeForResult(result))
            setTick((n) => n + 1)
          }}
        />
      )}

      {editing && (
        <LeadEditDialog
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={(result) => {
            setEditing(null)
            setNotice(noticeForResult(result))
            setTick((n) => n + 1)
          }}
        />
      )}
    </PageShell>
  )
}
