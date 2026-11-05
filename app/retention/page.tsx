import { RequireRole } from '@/components/auth/RequireRole'
import { RetentionScreen } from '@/components/retention/RetentionScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const RETENTION_DESK_ROLES: readonly Role[] = ['retention']

export default function RetentionPage() {
  return (
    <RequireRole anyOf={RETENTION_DESK_ROLES} exact>
      <RetentionScreen base="/retention" />
    </RequireRole>
  )
}
