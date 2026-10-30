'use client'

import { RequireRole } from '@/components/auth/RequireRole'
import { FronterDeskScreen } from '@/components/fronter/FronterDeskScreen'

export default function FronterDeskPage() {
  return (
    <RequireRole role="fronter">
      <FronterDeskScreen />
    </RequireRole>
  )
}
