'use client'

import { RequireRole } from '@/components/auth/RequireRole'
import { CardEditRequestsScreen } from '@/components/callbacks/CardEditRequestsScreen'

export default function AdminCardEditsPage() {
  // Team Admins and Super Admins; only a Super Admin decides.
  return (
    <RequireRole role="administrator">
      <CardEditRequestsScreen />
    </RequireRole>
  )
}
