'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { CampaignFormDialog } from '@/components/admin/CampaignFormDialog'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { AuthError } from '@/lib/auth'
import { listCampaigns, type Campaign } from '@/lib/campaigns'
import { formatDateTime } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'
import { listTeams, type Team } from '@/lib/teams'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; campaigns: Campaign[]; teams: Team[] }

/** The dialog's subject: a campaign to edit, null to add one, or closed. */
type Editing = { campaign: Campaign | null } | null

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403) {
    return 'You no longer have access to campaign administration.'
  }
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Could not load the campaign list.'
}

export function CampaignsScreen() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [editing, setEditing] = useState<Editing>(null)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession(async (token) => {
          // Teams name the Teams column and fill the form's checkboxes.
          const [campaigns, teams] = await Promise.all([listCampaigns(token), listTeams(token)])
          return { campaigns: campaigns.items, teams: teams.items }
        })
      )
      .then(({ campaigns, teams }) => {
        if (!cancelled) setLoad({ status: 'ready', campaigns, teams })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [reloads])

  const teamNameById =
    load.status === 'ready'
      ? new Map(load.teams.map((team) => [team.id, team.name]))
      : new Map<string, string>()

  const columns: DataColumn<Campaign>[] = [
    { id: 'name', header: 'Name', render: (campaign) => campaign.name },
    {
      id: 'teams',
      header: 'Teams',
      render: (campaign) =>
        campaign.team_ids.length > 0 ? (
          campaign.team_ids
            .map((id) => teamNameById.get(id) ?? 'Unknown team')
            .sort((a, b) => a.localeCompare(b))
            .join(', ')
        ) : (
          <span className="text-slate">No teams</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (campaign) =>
        campaign.active ? (
          <Badge tone="done" dot>
            Active
          </Badge>
        ) : (
          <Badge>Inactive</Badge>
        ),
    },
    {
      id: 'created_at',
      header: 'Created',
      render: (campaign) => (
        <span className="whitespace-nowrap">{formatDateTime(campaign.created_at)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      render: (campaign) => (
        <button
          type="button"
          onClick={() => setEditing({ campaign })}
          className="font-medium text-navy underline hover:text-black"
        >
          Edit<span className="sr-only"> {campaign.name}</span>
        </button>
      ),
    },
  ]

  const tableActions = (
    <div className="w-[160px]">
      <Button size="small" onClick={() => setEditing({ campaign: null })}>
        <span className="flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Add Campaign
        </span>
      </Button>
    </div>
  )

  return (
    <PageShell title="Campaigns">
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading campaigns…
        </p>
      )}

      {load.status === 'error' && <Alert>{load.message}</Alert>}

      {load.status === 'ready' && (
        <DataTable
          title="All Campaigns"
          ariaLabel="All campaigns"
          rows={load.campaigns}
          columns={columns}
          getRowId={(campaign) => campaign.id}
          emptyMessage="No campaigns yet."
          pageSize={10}
          actions={tableActions}
        />
      )}

      {editing && load.status === 'ready' && (
        <CampaignFormDialog
          campaign={editing.campaign}
          teams={load.teams}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setReloads((count) => count + 1)
          }}
        />
      )}
    </PageShell>
  )
}
