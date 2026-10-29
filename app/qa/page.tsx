import { RequireRole } from '@/components/auth/RequireRole'
import { QaQueueScreen } from '@/components/qa/QaQueueScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const QA_DESK_ROLES: readonly Role[] = ['qa_lead', 'qa_agent']

export default function QaHomePage() {
  return (
    <RequireRole anyOf={QA_DESK_ROLES} exact>
      <QaQueueScreen itemHref="/qa/item" />
    </RequireRole>
  )
}
