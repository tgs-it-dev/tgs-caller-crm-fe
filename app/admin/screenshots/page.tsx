'use client'

import { ScreenshotsScreen } from '@/components/admin/ScreenshotsScreen'
import { RequireRole } from '@/components/auth/RequireRole'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const SUPER_ADMIN_ROLES: readonly Role[] = ['super_admin']

export default function AdminScreenshotsPage() {
  return (
    <RequireRole anyOf={SUPER_ADMIN_ROLES} exact>
      <ScreenshotsScreen />
    </RequireRole>
  )
}
