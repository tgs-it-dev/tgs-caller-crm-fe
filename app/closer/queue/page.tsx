'use client'

import { RequireRole } from '@/components/auth/RequireRole'
import { QueueScreen } from '@/components/queue/QueueScreen'

export default function CloserQueuePage() {
  return (
    <RequireRole role="closer">
      <QueueScreen role="closer" />
    </RequireRole>
  )
}
