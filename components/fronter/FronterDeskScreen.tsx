'use client'

import { useCallback, useEffect, useState } from 'react'
import MuiAlert from '@mui/material/Alert'
import MuiButton from '@mui/material/Button'
import { Pencil, Plus } from 'lucide-react'
import { LeadCreateDialog } from '@/components/fronter/LeadCreateDialog'
import { LeadEditDialog } from '@/components/fronter/LeadEditDialog'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { formatDateTime, formatPhone } from '@/lib/format'
import { leadDisplayName } from '@/lib/leads'
import { waitForMocking } from '@/lib/mockReady'
import { listQueue, type FronterQueueEntry } from '@/lib/queue'
import { withSession } from '@/lib/session'

const POLL_MS = 5000

type CallbackLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: FronterQueueEntry[] }

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
      : `${name} offered to available closers.`
  }
  if (result.next === 'desk' && result.disposition) {
    return `${name} saved as ${result.disposition.label}.`
  }
  return `${name} saved.`
}

function callbackColumns(onEdit: (entry: FronterQueueEntry) => void): DataColumn<FronterQueueEntry>[] {
  return [
    {
      id: 'lead',
      header: 'Lead',
      render: (entry) => (
        <>
          <span className="font-medium text-ink">{entry.lead_name}</span>
          <span className="mt-1 block text-xs text-slate">{formatPhone(entry.lead_phone)}</span>
        </>
      ),
    },
    {
      id: 'disposition',
      header: 'Disposition',
      render: (entry) => entry.disposition_label,
    },
    {
      id: 'when',
      header: 'Created at',
      render: (entry) => (
        <span className="whitespace-nowrap">{formatDateTime(entry.dispositioned_at)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      render: (entry) => (
        <div className="whitespace-nowrap">
          <MuiButton
            size="small"
            variant="outlined"
            color="primary"
            onClick={() => onEdit(entry)}
            startIcon={<Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
            aria-label={`Edit ${entry.lead_name}`}
          >
            Edit
          </MuiButton>
        </div>
      ),
    },
  ]
}

/**
 * Fronter home: create / edit leads with disposition and transfer.
 * Active Call is not opened from this desk.
 */
export function FronterDeskScreen() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<FronterQueueEntry | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [load, setLoad] = useState<CallbackLoad>({ status: 'loading' })

  const refetch = useCallback(async () => {
    const entries = await withSession((token) => listQueue(token, 'fronter', { bust: true }))
    setLoad({ status: 'ready', entries })
  }, [])

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => listQueue(token, 'fronter')))
      .then((entries) => {
        if (!cancelled) setLoad({ status: 'ready', entries })
      })
      .catch(() => {
        if (!cancelled) {
          setLoad({ status: 'error', message: 'Unable to load callbacks right now.' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      void refetch().catch(() => {
        // Keep the last good snapshot on a failed poll.
      })
    }, POLL_MS)
    return () => clearInterval(id)
  }, [refetch])

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

        {load.status === 'loading' && (
          <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
            Loading callbacks…
          </p>
        )}
        {load.status === 'error' && <Alert>{load.message}</Alert>}
        {load.status === 'ready' && (
          <DataTable
            title="Scheduled callbacks"
            ariaLabel="Leads waiting for a callback"
            rows={load.entries}
            columns={callbackColumns((entry) => setEditing(entry))}
            getRowId={(entry) => entry.id}
            emptyMessage="No callbacks right now."
            minWidth="max-content"
          />
        )}
      </div>

      {createOpen && (
        <LeadCreateDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(result) => {
            setCreateOpen(false)
            setNotice(noticeForResult(result))
            void refetch().catch(() => {})
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
            void refetch().catch(() => {})
          }}
        />
      )}
    </PageShell>
  )
}
