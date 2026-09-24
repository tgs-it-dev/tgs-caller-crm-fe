import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { formatElapsed } from '@/lib/format'
import type { InteractionStatus } from '@/lib/interactions'

const STATUS_TONE: Record<InteractionStatus, 'teal' | 'amber' | 'neutral'> = {
  active: 'teal',
  wrap_up: 'amber',
  closed: 'neutral',
}

const STATUS_LABEL: Record<InteractionStatus, string> = {
  active: 'Live',
  wrap_up: 'Wrap-up',
  closed: 'Closed',
}

export function LiveCallStatus({
  status,
  startedAt,
}: {
  status: InteractionStatus
  startedAt: string
}) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startedAt))

  useEffect(() => {
    if (status !== 'active') return
    const id = setInterval(() => setElapsed(formatElapsed(startedAt)), 1000)
    return () => clearInterval(id)
  }, [status, startedAt])

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {status === 'active' && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-green opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-status-green" />
          </span>
        )}
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      <span className="font-mono text-sm tabular-nums text-slate">{elapsed}</span>
    </div>
  )
}
