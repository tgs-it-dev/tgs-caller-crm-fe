import { RequireRole } from '@/components/auth/RequireRole'
import { SettingsScreen } from '@/components/settings/SettingsScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const RETENTION_DESK_ROLES: readonly Role[] = ['retention']

export default function RetentionSettingsPage() {
  return (
    <RequireRole anyOf={RETENTION_DESK_ROLES} exact>
      <SettingsScreen />
    </RequireRole>
  )
}
