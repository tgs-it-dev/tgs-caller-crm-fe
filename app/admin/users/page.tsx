import { UsersScreen } from '@/components/admin/UsersScreen'
import { RequireRole } from '@/components/auth/RequireRole'
import type { Role } from '@/lib/auth'

/** Stable gate list — inline arrays would re-trigger RequireRole's effect. */
const USER_ADMIN_ROLES: readonly Role[] = ['administrator', 'qa_manager']

export default function AdminUsersPage() {
  // Team Admin (and Super Admin via roleSatisfies) plus QA Manager — never
  // treat qa_manager as administrator; both are named here on purpose.
  return (
    <RequireRole anyOf={USER_ADMIN_ROLES}>
      <UsersScreen />
    </RequireRole>
  )
}
