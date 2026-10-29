import { RequireRole } from '@/components/auth/RequireRole'
import { SettingsScreen } from '@/components/settings/SettingsScreen'
import type { Role } from '@/lib/auth'

const QA_DESK_ROLES: readonly Role[] = ['qa_lead', 'qa_agent']

export default function QaSettingsPage() {
  return (
    <RequireRole anyOf={QA_DESK_ROLES} exact>
      <SettingsScreen />
    </RequireRole>
  )
}
