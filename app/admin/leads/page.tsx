import { LeadsScreen } from '@/components/admin/LeadsScreen'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminLeadsPage() {
  return (
    <RequireRole role="administrator" exact>
      <LeadsScreen />
    </RequireRole>
  )
}
