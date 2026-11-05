'use client'

import { RequireRole } from '@/components/auth/RequireRole'
import { CallbackRequestsScreen } from '@/components/callbacks/CallbackRequestsScreen'

export default function AdminCallbacksPage() {
  // Team Admins and Super Admins; only a Super Admin decides.
  return (
    <RequireRole role="administrator">
      <CallbackRequestsScreen />
    </RequireRole>
  )
}
