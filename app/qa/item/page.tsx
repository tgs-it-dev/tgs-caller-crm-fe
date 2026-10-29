import { Suspense } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { QaItemScreen } from '@/components/qa/QaItemScreen'
import type { Role } from '@/lib/auth'

const QA_DESK_ROLES: readonly Role[] = ['qa_lead', 'qa_agent']

export default function QaItemPage() {
  return (
    <RequireRole anyOf={QA_DESK_ROLES} exact>
      {/* The sale comes from `?id=`, which a static export can only read on the client. */}
      <Suspense fallback={null}>
        <QaItemScreen backHref="/qa" />
      </Suspense>
    </RequireRole>
  )
}
