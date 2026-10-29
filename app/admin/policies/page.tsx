import { PolicyLookupScreen } from '@/components/admin/PolicyLookupScreen'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminPoliciesPage() {
  // Team Admins and Super Admins; a Team Admin finds only their own team's sales.
  return (
    <RequireRole role="administrator">
      <PolicyLookupScreen />
    </RequireRole>
  )
}
