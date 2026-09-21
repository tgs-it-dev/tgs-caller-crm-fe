import { LiveDashboard } from '@/components/admin/LiveDashboard'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminDashboardPage() {
  return (
    <RequireRole role="administrator">
      <LiveDashboard />
    </RequireRole>
  )
}
