'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { TeamFormDialog } from '@/components/admin/TeamFormDialog'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { AuthError } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'
import { listTeams, type Team } from '@/lib/teams'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; teams: Team[] }

/** The dialog's subject: a team to edit, null to add one, or closed. */
type Editing = { team: Team | null } | null

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403) {
    return 'You no longer have access to team administration.'
  }
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Could not load the team list.'
}

export function TeamsScreen() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [editing, setEditing] = useState<Editing>(null)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => listTeams(token)))
      .then((list) => {
        if (!cancelled) setLoad({ status: 'ready', teams: list.items })
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [reloads])

  const columns: DataColumn<Team>[] = [
    { id: 'name', header: 'Name', render: (team) => team.name },
    {
      id: 'status',
      header: 'Status',
      render: (team) =>
        team.active ? (
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
      render: (team) => (
        <span className="whitespace-nowrap">{formatDateTime(team.created_at)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      render: (team) => (
        <button
          type="button"
          onClick={() => setEditing({ team })}
          className="font-medium text-navy underline hover:text-black"
        >
          Edit<span className="sr-only"> {team.name}</span>
        </button>
      ),
    },
  ]

  const tableActions = (
    <div className="w-[140px]">
      <Button size="small" onClick={() => setEditing({ team: null })}>
        <span className="flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Add Team
        </span>
      </Button>
    </div>
  )

  return (
    <PageShell title="Teams">
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading teams…
        </p>
      )}

      {load.status === 'error' && <Alert>{load.message}</Alert>}

      {load.status === 'ready' && (
        <DataTable
          title="All Teams"
          ariaLabel="All teams"
          rows={load.teams}
          columns={columns}
          getRowId={(team) => team.id}
          emptyMessage="No teams yet."
          pageSize={10}
          actions={tableActions}
        />
      )}

      {editing && (
        <TeamFormDialog
          team={editing.team}
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
