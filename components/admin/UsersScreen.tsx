'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus, Search, UserCheck, UserCog, UserMinus, Users, X } from 'lucide-react'
import { UserFormDialog } from '@/components/admin/UserFormDialog'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import { Input } from '@/components/ui/Input'
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

type StaffRole = Exclude<Role, 'super_admin'>

/** Empty string = every team / role / status (no filter). */
type TeamFilter = string
type RoleFilter = '' | StaffRole
type StatusFilter = '' | 'active' | 'inactive'

const STAFF_ROLES = ASSIGNABLE_ROLES.filter(
  (role): role is StaffRole => role !== 'super_admin',
)

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

function matchesSearch(user: User, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
}

function matchesFilters(
  user: User,
  filters: { search: string; role: RoleFilter; status: StatusFilter },
): boolean {
  if (!matchesSearch(user, filters.search)) return false
  if (filters.role && !user.roles.includes(filters.role)) return false
  if (filters.status === 'active' && !user.active) return false
  if (filters.status === 'inactive' && user.active) return false
  return true
}

/** Roster counts for the team scope — used by the quick-filter strip. */
function rosterFigures(users: User[]) {
  return {
    total: users.length,
    active: users.filter((user) => user.active).length,
    inactive: users.filter((user) => !user.active).length,
    admins: users.filter((user) => user.roles.includes('administrator')).length,
  }
}

/**
 * One cell in the roster summary strip. Clicking filters the table; selected
 * state is a soft navy wash + left rule — not a solid filled pill.
 */
function StatCell({
  label,
  count,
  icon,
  selected,
  onClick,
  showDivider,
}: {
  label: string
  count: number
  icon: ReactNode
  selected: boolean
  onClick: () => void
  showDivider?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'relative flex min-w-0 flex-1 flex-col gap-3 px-5 py-4 text-left transition-colors',
        showDivider ? 'border-t-hairline border-slate sm:border-t-0 sm:border-l-hairline' : '',
        selected ? 'bg-[rgba(31,58,95,0.06)]' : 'bg-transparent hover:bg-shop-floor/80',
      ].join(' ')}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-navy sm:inset-y-4"
        />
      )}
      <span className="flex items-center gap-2 text-sm leading-[150%] text-body-text">
        <span className="inline-flex h-4 w-4 shrink-0 text-slate [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        {label}
      </span>
      <span className="text-[28px] font-semibold leading-none text-ink tabular-nums">{count}</span>
    </button>
  )
}

/** Removable active-filter pill under the toolbar (HubSpot filter bar). */
function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-md border-hairline border-slate bg-shop-floor px-2.5 py-1 text-xs font-medium leading-[170%] text-ink hover:border-navy hover:text-navy"
    >
      {label}
      <X className="h-3.5 w-3.5 shrink-0 text-slate" strokeWidth={2} aria-hidden />
      <span className="sr-only">Remove filter</span>
    </button>
  )
}

export function UsersScreen() {
  const { user: signedIn, refresh: refreshSignedIn } = useCurrentUser()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [editing, setEditing] = useState<Editing>(null)
  // Bumped to read the list again — after adding someone, or changing one.
  const [reloads, setReloads] = useState(0)
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [search, setSearch] = useState('')
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

  // Quick-filter counts stay on the team-scoped roster so picking a view never
  // zeroes out the other chips the way filtered-table stats would.
  const figures = useMemo(() => rosterFigures(sortedUsers), [sortedUsers])

  const visibleUsers = useMemo(
    () =>
      sortedUsers.filter((user) =>
        matchesFilters(user, { search, role: roleFilter, status: statusFilter }),
      ),
    [sortedUsers, search, roleFilter, statusFilter],
  )

  const filtersActive = Boolean(search.trim() || roleFilter || statusFilter || teamFilter)

  function clearFilters() {
    setSearch('')
    setRoleFilter('')
    setStatusFilter('')
    setTeamFilter('')
  }

  /** HubSpot view chips: one dimension at a time for status / admin. */
  function selectView(view: 'all' | 'active' | 'inactive' | 'admins') {
    setSearch('')
    if (view === 'all') {
      setRoleFilter('')
      setStatusFilter('')
      return
    }
    if (view === 'admins') {
      setRoleFilter('administrator')
      setStatusFilter('')
      return
    }
    setRoleFilter('')
    setStatusFilter(view)
  }

  // null when role + status are combined in a way that isn't one of the views.
  const activeView: 'all' | 'active' | 'inactive' | 'admins' | null =
    roleFilter === 'administrator' && !statusFilter
      ? 'admins'
      : statusFilter === 'active' && !roleFilter
        ? 'active'
        : statusFilter === 'inactive' && !roleFilter
          ? 'inactive'
          : !roleFilter && !statusFilter
            ? 'all'
            : null

  const teamBands = useMemo(() => teamBandIndexById(visibleUsers), [visibleUsers])

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

  const activeFilterChips: { key: string; label: string; clear: () => void }[] = []
  if (roleFilter) {
    activeFilterChips.push({
      key: 'role',
      label: `Role: ${roleLabel(roleFilter)}`,
      clear: () => setRoleFilter(''),
    })
  }
  if (statusFilter) {
    activeFilterChips.push({
      key: 'status',
      label: `Status: ${statusFilter === 'active' ? 'Active' : 'Inactive'}`,
      clear: () => setStatusFilter(''),
    })
  }
  if (teamFilter && load.status === 'ready') {
    activeFilterChips.push({
      key: 'team',
      label: `Team: ${teamNameById.get(teamFilter) ?? 'Unknown'}`,
      clear: () => setTeamFilter(''),
    })
  }
  if (search.trim()) {
    activeFilterChips.push({
      key: 'search',
      label: `Search: ${search.trim()}`,
      clear: () => setSearch(''),
    })
  }

  return (
    <PageShell title="Users">
      {load.status === 'loading' && (
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading users…
        </p>
      )}

      {load.status === 'error' && <Alert>{load.message}</Alert>}

      {load.status === 'ready' && (
        <div className="flex flex-1 flex-col gap-5">
          {/* Single summary strip — four metrics, one card (CRM index pattern). */}
          <div
            className="overflow-hidden rounded-xl border-hairline border-slate bg-white"
            role="toolbar"
            aria-label="User views"
          >
            <div className="flex flex-col sm:flex-row">
              <StatCell
                label="Total users"
                count={figures.total}
                icon={<Users strokeWidth={2} aria-hidden />}
                selected={activeView === 'all'}
                onClick={() => selectView('all')}
              />
              <StatCell
                label="Active"
                count={figures.active}
                icon={<UserCheck strokeWidth={2} aria-hidden />}
                selected={activeView === 'active'}
                onClick={() => selectView('active')}
                showDivider
              />
              <StatCell
                label="Inactive"
                count={figures.inactive}
                icon={<UserMinus strokeWidth={2} aria-hidden />}
                selected={activeView === 'inactive'}
                onClick={() => selectView('inactive')}
                showDivider
              />
              <StatCell
                label="Team admins"
                count={figures.admins}
                icon={<UserCog strokeWidth={2} aria-hidden />}
                selected={activeView === 'admins'}
                onClick={() => selectView('admins')}
                showDivider
              />
            </div>
          </div>

          <DataTable
            // Remount when discrete filters change so paging resets. Search is
            // left out — putting it in the key remounted the field each keystroke.
            key={`${teamFilter}|${roleFilter}|${statusFilter}`}
            title="All Users"
            ariaLabel="All users"
            rows={visibleUsers}
            columns={columns}
            getRowId={(user) => user.id}
            emptyMessage={
              filtersActive ? 'No users match these filters.' : 'No users yet.'
            }
            pageSize={10}
            actions={
              <div className="w-[140px]">
                <Button size="small" onClick={() => setEditing({ user: null })}>
                  <span className="flex items-center justify-center gap-2">
                    <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Add User
                  </span>
                </Button>
              </div>
            }
            toolbar={
              <div className="flex flex-col gap-3">
                {/* Search leads; property filters sit to the right — CRM index toolbar. */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <Input
                      size="small"
                      aria-label="Search by name or email"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name or email"
                      autoComplete="off"
                      startAdornment={
                        <Search className="h-4 w-4 text-slate" strokeWidth={2} aria-hidden />
                      }
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-[148px]">
                      <Select
                        size="small"
                        value={roleFilter}
                        aria-label="Filter by role"
                        onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                      >
                        <option value="">All roles</option>
                        {STAFF_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(role)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="w-[140px]">
                      <Select
                        size="small"
                        value={statusFilter}
                        aria-label="Filter by status"
                        onChange={(event) =>
                          setStatusFilter(event.target.value as StatusFilter)
                        }
                      >
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </Select>
                    </div>
                    {saView && (
                      <div className="w-[168px]">
                        <Select
                          size="small"
                          value={teamFilter}
                          aria-label="Filter by team"
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
                  </div>
                </div>

                {filtersActive && (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeFilterChips.map((chip) => (
                      <ActiveFilterChip
                        key={chip.key}
                        label={chip.label}
                        onRemove={chip.clear}
                      />
                    ))}
                    <span className="text-xs tabular-nums text-slate">
                      {visibleUsers.length}{' '}
                      {visibleUsers.length === 1 ? 'result' : 'results'}
                    </span>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="ml-auto text-xs font-medium text-navy hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            }
          />
        </div>
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
