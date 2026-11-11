import { DataUploadScreen } from '@/components/dataUpload/DataUploadScreen'
import { RequireRole } from '@/components/auth/RequireRole'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const SUPER_ADMIN_ROLES: readonly Role[] = ['super_admin']

export default function AdminDataUploadPage() {
  return (
    <RequireRole anyOf={SUPER_ADMIN_ROLES} exact>
      <DataUploadScreen />
    </RequireRole>
  )
}
