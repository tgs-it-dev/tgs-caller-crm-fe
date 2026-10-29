import { Suspense } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { QaItemScreen } from '@/components/qa/QaItemScreen'
import type { Role } from '@/lib/auth'

const QA_OVERSIGHT_ROLES: readonly Role[] = ['super_admin', 'qa_manager']

export default function AdminQaItemPage() {
  return (
    <RequireRole anyOf={QA_OVERSIGHT_ROLES} exact>
      {/* The sale comes from `?id=`, which a static export can only read on the client. */}
      <Suspense fallback={null}>
        <QaItemScreen backHref="/admin/qa" />
      </Suspense>
    </RequireRole>
  )
}
