import { RequireRole } from '@/components/auth/RequireRole'
import { RetentionScreen } from '@/components/retention/RetentionScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const SUPER_ADMIN_ROLES: readonly Role[] = ['super_admin']

export default function AdminRetentionPage() {
  return (
    <RequireRole anyOf={SUPER_ADMIN_ROLES} exact>
      <RetentionScreen base="/admin/retention" />
    </RequireRole>
  )
}
