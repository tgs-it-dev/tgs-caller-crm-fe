import { RequireRole } from '@/components/auth/RequireRole'
import { RetentionUploadScreen } from '@/components/retention/RetentionUploadScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const SUPER_ADMIN_ROLES: readonly Role[] = ['super_admin']

export default function AdminRetentionUploadPage() {
  return (
    <RequireRole anyOf={SUPER_ADMIN_ROLES} exact>
      <RetentionUploadScreen />
    </RequireRole>
  )
}
