import { RequireRole } from '@/components/auth/RequireRole'
import { QaStatsScreen } from '@/components/qa/QaStatsScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const QA_OVERSIGHT_ROLES: readonly Role[] = ['super_admin', 'qa_manager']

export default function AdminQaStatsPage() {
  return (
    <RequireRole anyOf={QA_OVERSIGHT_ROLES} exact>
      <QaStatsScreen />
    </RequireRole>
  )
}
