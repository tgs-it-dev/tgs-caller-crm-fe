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
import { AuthError } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'
import { listUsers, rolesLabel, type User } from '@/lib/users'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; users: User[] }

/** The dialog's subject: a user to edit, null to add one, or closed. */
type Editing = { user: User | null } | null

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

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession(listUsers))
      .then((list) => {
        if (!cancelled) setLoad({ status: 'ready', users: list.items })
      })
      .catch((err) => {
        // The list goes with the access that allowed it.
        if (!cancelled) setLoad({ status: 'error', message: messageFor(err) })
      })

    return () => {
      cancelled = true
    }
  }, [reloads])

  const isSelf = (user: User) => user.id === signedIn?.id

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
      header: <span className="sr-only">Actions</span>,
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
          emptyMessage="No users yet."
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
        />
      )}

      {editing && (
        <UserFormDialog
          user={editing.user}
          isSelf={Boolean(editing.user && isSelf(editing.user))}
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
