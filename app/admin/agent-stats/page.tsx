import { Suspense } from 'react'
import { AgentStatsScreen } from '@/components/admin/AgentStatsScreen'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminAgentStatsPage() {
  return (
    // A Team Admin sees their own team; a Super Admin every team.
    <RequireRole role="administrator">
      {/* The filters live in the URL, which a static export can only read on the client. */}
      <Suspense fallback={null}>
        <AgentStatsScreen />
      </Suspense>
    </RequireRole>
  )
}
