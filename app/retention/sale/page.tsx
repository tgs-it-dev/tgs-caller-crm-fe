import { Suspense } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { RetentionSaleScreen } from '@/components/retention/RetentionSaleScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const RETENTION_DESK_ROLES: readonly Role[] = ['retention']

export default function RetentionSalePage() {
  return (
    <RequireRole anyOf={RETENTION_DESK_ROLES} exact>
      {/* The sale comes from `?id=`, which a static export can only read on the client. */}
      <Suspense fallback={null}>
        <RetentionSaleScreen base="/retention" />
      </Suspense>
    </RequireRole>
  )
}
