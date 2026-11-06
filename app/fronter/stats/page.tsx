'use client'

import { RequireRole } from '@/components/auth/RequireRole'
import { MyStatsScreen } from '@/components/stats/MyStatsScreen'

export default function FronterStatsPage() {
  return (
    <RequireRole role="fronter">
      <MyStatsScreen />
    </RequireRole>
  )
}
