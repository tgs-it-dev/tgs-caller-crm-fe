'use client'

import { useEffect, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { LeadFormDialog } from '@/components/admin/LeadFormDialog'
import { LeadUploadDialog } from '@/components/admin/LeadUploadDialog'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { AuthError } from '@/lib/auth'
import { listCampaigns, type Campaign } from '@/lib/campaigns'
import { formatDateTime, formatPhone } from '@/lib/format'
import { SOURCE_LABEL } from '@/lib/leadSource'
import { listLeads, type LeadList, type LeadResponse } from '@/lib/leads'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

const PAGE_LIMIT = 10

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: LeadList; campaigns: Campaign[] }

/** Which dialog is open: one lead, a file of them, or neither. */
type Adding = 'one' | 'file' | null

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403) {
    return 'You no longer have access to lead management.'
  }
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Could not load the lead list.'
}

const COLUMNS: DataColumn<LeadResponse>[] = [
  {
    id: 'phone',
    header: 'Phone',
    render: (lead) => (
      <span className="whitespace-nowrap">{formatPhone(lead.phone_normalized)}</span>
    ),
  },
  { id: 'source', header: 'Source', render: (lead) => SOURCE_LABEL[lead.source] },
  {
    id: 'added',
    header: 'Added',
    render: (lead) => <span className="whitespace-nowrap">{formatDateTime(lead.created_at)}</span>,
  },
]

export function LeadsScreen() {
  const [offset, setOffset] = useState(0)
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [adding, setAdding] = useState<Adding>(null)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession(async (token) => {
          // Only an active campaign can label a new lead on the queue.
          const [list, campaigns] = await Promise.all([
            listLeads({ limit: PAGE_LIMIT, offset }, token),
            listCampaigns(token),
          ])
          return { list, campaigns: campaigns.items.filter((campaign) => campaign.active) }
        })
      )
      .then(({ list, campaigns }) => {
        if (!cancelled) setLoad({ status: 'ready', list, campaigns })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [offset, reloads])

  /** Newest first, so whatever was just added is on the first page. */
  function showAdded() {
    setAdding(null)
    setOffset(0)
    setReloads((count) => count + 1)
  }

  const tableActions = (
    <div className="flex items-center gap-3">
      <div className="w-[140px]">
        <Button size="small" variant="secondary" onClick={() => setAdding('file')}>
          <span className="flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" strokeWidth={2} aria-hidden />
            Upload CSV
          </span>
        </Button>
      </div>
      <div className="w-[140px]">
        <Button size="small" onClick={() => setAdding('one')}>
          <span className="flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Add Lead
          </span>
        </Button>
      </div>
    </div>
  )

  return (
    <PageShell title="Leads">
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading leads…
        </p>
      )}

      {load.status === 'error' && <Alert>{load.message}</Alert>}

      {load.status === 'ready' && (
        <DataTable
          title="Team Leads"
          ariaLabel="Team leads"
          rows={load.list.items}
          columns={COLUMNS}
          getRowId={(lead) => lead.id}
          emptyMessage="No leads yet."
          paging={{
            total: load.list.total,
            limit: load.list.limit,
            offset: load.list.offset,
            onOffsetChange: setOffset,
          }}
          actions={tableActions}
        />
      )}

      {adding === 'one' && load.status === 'ready' && (
        <LeadFormDialog
          campaigns={load.campaigns}
          onClose={() => setAdding(null)}
          onSaved={showAdded}
        />
      )}

      {adding === 'file' && load.status === 'ready' && (
        <LeadUploadDialog
          campaigns={load.campaigns}
          onClose={() => setAdding(null)}
          onSaved={showAdded}
        />
      )}
    </PageShell>
  )
}
