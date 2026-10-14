'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { UserFormDialog } from '@/components/admin/UserFormDialog'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { Select } from '@/components/ui/Select'
import { AuthError, isSuperAdmin } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'
import { listTeams, type Team } from '@/lib/teams'
import { listUsers, rolesLabel, type User } from '@/lib/users'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; users: User[]; teams: Team[] }

/** The dialog's subject: a user to edit, null to add one, or closed. */
type Editing = { user: User | null } | null

/** Empty string = every team (no `team_id` on the list call). */
type TeamFilter = string

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403) {
    return 'You no longer have access to user administration.'
  }
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Could not load the user list.'
}

export function UsersScreen() {
  const { user: signedIn, refresh: refreshSignedIn } = useCurrentUser()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [editing, setEditing] = useState<Editing>(null)
  // Bumped to read the list again — after adding someone, or changing one.
  const [reloads, setReloads] = useState(0)
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('')
  const saView = Boolean(signedIn && isSuperAdmin(signedIn.roles))

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() =>
        withSession(async (token) => {
          const list = await listUsers(token, {
            teamId: saView && teamFilter ? teamFilter : null,
          })
          // Team names label the SA Team column + filter; Team Admin does not need the catalogue.
          const teams = saView ? (await listTeams(token)).items : []
          return { list, teams }
        })
      )
      .then(({ list, teams }) => {
        // Super Admin rows are not managed from this tab.
        const users = list.items.filter((user) => !user.roles.includes('super_admin'))
        if (!cancelled) setLoad({ status: 'ready', users, teams })
      })
      .catch((err) => {
        // The list goes with the access that allowed it.
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [reloads, saView, teamFilter])

  const isSelf = (user: User) => user.id === signedIn?.id

  const teamNameById =
    load.status === 'ready' ? new Map(load.teams.map((team) => [team.id, team.name])) : new Map()

  const columns: DataColumn<User>[] = [
    { id: 'name', header: 'Name', render: (user) => user.name },
    {
      id: 'email',
      header: 'Email',
      // The table lays its columns out at a fixed width, and an address is as
      // long as someone made it: wrap rather than run into the next column.
      render: (user) => <span className="break-all">{user.email}</span>,
    },
    { id: 'roles', header: 'Role', render: (user) => rolesLabel(user.roles) },
    ...(saView
      ? [
          {
            id: 'team_name',
            header: 'Team',
            render: (user: User) =>
              user.team_id ? (
                (teamNameById.get(user.team_id) ?? 'Unknown team')
              ) : (
                <span className="text-slate">—</span>
              ),
          } satisfies DataColumn<User>,
          {
            id: 'team_id',
            header: 'Team ID',
            render: (user: User) =>
              user.team_id ? (
                <span className="break-all font-mono text-sm">{user.team_id}</span>
              ) : (
                <span className="text-slate">—</span>
              ),
          } satisfies DataColumn<User>,
        ]
      : []),
    {
      id: 'status',
      header: 'Status',
      render: (user) =>
        user.active ? (
          <Badge tone="done" dot>
            Active
          </Badge>
        ) : (
          <Badge>Inactive</Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      render: (user) => (
        <button
          type="button"
          onClick={() => setEditing({ user })}
          className="font-medium text-navy underline hover:text-black"
        >
          Edit<span className="sr-only"> {user.name}</span>
        </button>
      ),
    },
  ]

  const tableActions = (
    <div className="flex items-center gap-3">
      {saView && load.status === 'ready' && (
        <div className="w-[200px]">
          <Select
            label=""
            size="small"
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
          >
            <option value="">All teams</option>
            {[...load.teams]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
          </Select>
        </div>
      )}
      <div className="w-[140px]">
        <Button size="small" onClick={() => setEditing({ user: null })}>
          <span className="flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Add User
          </span>
        </Button>
      </div>
    </div>
  )

  return (
    <PageShell title="Users">
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading users…
        </p>
      )}

      {load.status === 'error' && <Alert>{load.message}</Alert>}

      {load.status === 'ready' && (
        <DataTable
          title="All Users"
          ariaLabel="All users"
          rows={load.users}
          columns={columns}
          getRowId={(user) => user.id}
          emptyMessage={teamFilter ? 'No users on this team.' : 'No users yet.'}
          pageSize={10}
          actions={tableActions}
        />
      )}

      {editing && signedIn && load.status === 'ready' && (
        <UserFormDialog
          user={editing.user}
          actorRoles={signedIn.roles}
          isSelf={Boolean(editing.user && isSelf(editing.user))}
          teams={load.teams}
          onClose={() => setEditing(null)}
          onSaved={() => {
            // Their own name or roles may have changed; the sidebar shows both.
            if (editing.user && isSelf(editing.user)) void refreshSignedIn()
            setEditing(null)
            setReloads((count) => count + 1)
          }}
        />
      )}
    </PageShell>
  )
}
