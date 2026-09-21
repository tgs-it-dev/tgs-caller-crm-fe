'use client'

import { RequireRole } from '@/components/auth/RequireRole'
import { QueueScreen } from '@/components/queue/QueueScreen'

export default function FronterQueuePage() {
  return (
    <RequireRole role="fronter">
      <QueueScreen role="fronter" />
    </RequireRole>
  )
}
