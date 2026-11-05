import { RequireRole } from '@/components/auth/RequireRole'
import { RetentionUploadScreen } from '@/components/retention/RetentionUploadScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const RETENTION_DESK_ROLES: readonly Role[] = ['retention']

export default function RetentionUploadPage() {
  return (
    <RequireRole anyOf={RETENTION_DESK_ROLES} exact>
      <RetentionUploadScreen />
    </RequireRole>
  )
}
