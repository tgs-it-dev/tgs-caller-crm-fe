'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { UserFormDialog } from '@/components/admin/UserFormDialog'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { PageShell } from '@/components/ui/PageShell'
import { Select } from '@/components/ui/Select'
import { AuthError, isSuperAdmin, type Role } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'
import { listTeams, type Team } from '@/lib/teams'
import { tokens } from '@/lib/theme'
import {
  ASSIGNABLE_ROLES,
  listUsers,
  roleLabel,
  type User,
} from '@/lib/users'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; users: User[]; teams: Team[] }

/** The dialog's subject: a user to edit, null to add one, or closed. */
type Editing = { user: User | null } | null

/** Empty string = every team (no filter). */
type TeamFilter = string

type StaffRole = Exclude<Role, 'super_admin'>

const ROLE_BADGE_TONE: Record<StaffRole, 'teal' | 'amber' | 'neutral'> = {
  administrator: 'amber',
  closer: 'teal',
  fronter: 'neutral',
}

/** Rotating badge colours so each team is visually distinct in the Team column. */
const TEAM_BADGE_COLORS = [
  { fg: tokens.navy, bg: 'rgba(31, 58, 95, 0.12)' },
  { fg: tokens.status.blue, bg: 'rgba(62, 124, 177, 0.14)' },
  { fg: tokens.status.green, bg: 'rgba(79, 138, 91, 0.14)' },
  { fg: tokens.status.gold, bg: 'rgba(201, 154, 62, 0.16)' },
  { fg: '#7A5FA3', bg: 'rgba(122, 95, 163, 0.14)' },
  { fg: tokens.status.red, bg: 'rgba(181, 80, 74, 0.12)' },
] as const

function TeamBadge({ name, band }: { name: string; band: number }) {
  const color = TEAM_BADGE_COLORS[band % TEAM_BADGE_COLORS.length]
  return (
    <span
      className="inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-xs font-semibold leading-[170%]"
      style={{ color: color.fg, backgroundColor: color.bg }}
    >
      {name}
    </span>
  )
}

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 403) {
    return 'You no longer have access to user administration.'
  }
  if (err instanceof AuthError && err.status === 401) {
    return 'Your session has ended. Please sign in again.'
  }
  return 'Could not load the user list.'
}

function staffRoles(roles: Role[]): StaffRole[] {
  return ASSIGNABLE_ROLES.filter(
    (role): role is StaffRole => role !== 'super_admin' && roles.includes(role)
  )
}

function RoleBadges({ roles }: { roles: Role[] }) {
  const shown = staffRoles(roles)
  if (shown.length === 0) return <span className="text-slate">—</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((role) => (
        <Badge key={role} tone={ROLE_BADGE_TONE[role]}>
          {roleLabel(role)}
        </Badge>
      ))}
    </span>
  )
}

/** Stable colour index per team key, in first-seen order after sort. */
function teamBandIndexById(users: User[]): Map<string, number> {
  const bands = new Map<string, number>()
  let next = 0
  for (const user of users) {
    const key = user.team_id ?? '__unassigned__'
    if (!bands.has(key)) {
      bands.set(key, next)
      next += 1
    }
  }
  return bands
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
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [reloads, saView, teamFilter])

  const isSelf = (user: User) => user.id === signedIn?.id

  const teamNameById = useMemo(
    () =>
      load.status === 'ready'
        ? new Map(load.teams.map((team) => [team.id, team.name]))
        : new Map<string, string>(),
    [load],
  )

  const sortedUsers = useMemo(() => {
    if (load.status !== 'ready') return []
    const rows = load.users
    if (!saView) {
      return [...rows].sort((a, b) => a.name.localeCompare(b.name))
    }
    return [...rows].sort((a, b) => {
      const aName = a.team_id ? (teamNameById.get(a.team_id) ?? '') : 'zzz'
      const bName = b.team_id ? (teamNameById.get(b.team_id) ?? '') : 'zzz'
      const byTeam = aName.localeCompare(bName)
      if (byTeam !== 0) return byTeam
      return a.name.localeCompare(b.name)
    })
  }, [load, saView, teamNameById])

  const teamBands = useMemo(() => teamBandIndexById(sortedUsers), [sortedUsers])

  const columns: DataColumn<User>[] = [
    { id: 'name', header: 'Name', render: (user) => user.name },
    {
      id: 'email',
      header: 'Email',
      render: (user) => <span className="break-all">{user.email}</span>,
    },
    {
      id: 'roles',
      header: 'Role',
      render: (user) => <RoleBadges roles={user.roles} />,
    },
    ...(saView
      ? [
          {
            id: 'team_name',
            header: 'Team',
            render: (user: User) => {
              if (!user.team_id) {
                return <span className="text-slate">—</span>
              }
              return (
                <TeamBadge
                  name={teamNameById.get(user.team_id) ?? 'Unknown team'}
                  band={teamBands.get(user.team_id) ?? 0}
                />
              )
            },
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
          key={teamFilter}
          title="All Users"
          ariaLabel="All users"
          rows={sortedUsers}
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
