import { UsersScreen } from '@/components/admin/UsersScreen'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminUsersPage() {
  return (
    <RequireRole role="administrator">
      <UsersScreen />
    </RequireRole>
  )
}
