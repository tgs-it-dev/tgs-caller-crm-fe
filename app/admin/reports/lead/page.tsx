import { Suspense } from 'react'
import { LeadDetailScreen } from '@/components/admin/LeadDetailScreen'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminLeadDetailPage() {
  return (
    // A lead's full view is the Super Admin's; a Team Admin is sent back to their desk.
    <RequireRole role="super_admin">
      {/* The lead comes from `?id=`, which a static export can only read on the client. */}
      <Suspense fallback={null}>
        <LeadDetailScreen />
      </Suspense>
    </RequireRole>
  )
}
