import { RequireRole } from '@/components/auth/RequireRole'
import { QaQueueScreen } from '@/components/qa/QaQueueScreen'
import type { Role } from '@/lib/auth'

/** Stable gate list: inline arrays would re-trigger RequireRole's effect. */
const QA_OVERSIGHT_ROLES: readonly Role[] = ['super_admin', 'qa_manager']

export default function AdminQaPage() {
  return (
    <RequireRole anyOf={QA_OVERSIGHT_ROLES} exact>
      <QaQueueScreen itemHref="/admin/qa/item" />
    </RequireRole>
  )
}
