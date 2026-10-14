import { TeamsScreen } from '@/components/admin/TeamsScreen'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminTeamsPage() {
  return (
    <RequireRole role="super_admin">
      <TeamsScreen />
    </RequireRole>
  )
}
