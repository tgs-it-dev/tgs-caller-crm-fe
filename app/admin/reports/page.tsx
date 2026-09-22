import { HistoricalFunnel } from '@/components/admin/HistoricalFunnel'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminReportsPage() {
  return (
    <RequireRole role="administrator">
      <HistoricalFunnel />
    </RequireRole>
  )
}
