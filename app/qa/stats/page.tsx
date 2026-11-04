import { RequireRole } from '@/components/auth/RequireRole'
import { QaStatsScreen } from '@/components/qa/QaStatsScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const QA_DESK_ROLES: readonly Role[] = ['qa_agent']

export default function QaStatsPage() {
  return (
    <RequireRole anyOf={QA_DESK_ROLES} exact>
      <QaStatsScreen />
    </RequireRole>
  )
}
