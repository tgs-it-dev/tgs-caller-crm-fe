import { TeamStatsScreen } from '@/components/admin/TeamStatsScreen'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminTeamStatsPage() {
  return (
    <RequireRole role="super_admin">
      <TeamStatsScreen />
    </RequireRole>
  )
}
