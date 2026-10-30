import { RequireRole } from '@/components/auth/RequireRole'
import { SettingsScreen } from '@/components/settings/SettingsScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list — inline arrays would re-trigger RequireRole's effect. */
const ADMIN_DESK_ROLES: readonly Role[] = ['administrator', 'qa_manager']

export default function AdminSettingsPage() {
  // Personal settings on the admin desk — Team Admin (SA inherits) and QA Manager.
  return (
    <RequireRole anyOf={ADMIN_DESK_ROLES}>
      <SettingsScreen />
    </RequireRole>
  )
}
