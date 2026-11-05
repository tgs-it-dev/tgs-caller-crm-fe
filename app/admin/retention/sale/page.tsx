import { Suspense } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { RetentionSaleScreen } from '@/components/retention/RetentionSaleScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const SUPER_ADMIN_ROLES: readonly Role[] = ['super_admin']

export default function AdminRetentionSalePage() {
  return (
    <RequireRole anyOf={SUPER_ADMIN_ROLES} exact>
      {/* The sale comes from `?id=`, which a static export can only read on the client. */}
      <Suspense fallback={null}>
        <RetentionSaleScreen base="/admin/retention" />
      </Suspense>
    </RequireRole>
  )
}
