'use client'

import { RequireRole } from '@/components/auth/RequireRole'
import { MyStatsScreen } from '@/components/stats/MyStatsScreen'

export default function CloserStatsPage() {
  return (
    <RequireRole role="closer">
      <MyStatsScreen />
    </RequireRole>
  )
}
