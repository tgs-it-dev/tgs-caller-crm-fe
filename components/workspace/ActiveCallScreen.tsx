'use client'

import { useEffect, useState } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { CallerLeadInfo } from './CallerLeadInfo'
import { DispositionCard } from './DispositionCard'
import { QualificationChecklist } from './QualificationChecklist'
import { TransferPanel } from './TransferPanel'

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function LiveCallBadge() {
  const [elapsed, setElapsed] = useState(42)

  useEffect(() => {
    const id = setInterval(() => setElapsed((prev) => prev + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-3">
      <Badge tone="live" dot>
        Live
      </Badge>
      <span className="text-sm text-ink">on call — {formatElapsed(elapsed)}</span>
    </div>
  )
}

export function ActiveCallScreen({ interactionId }: { interactionId: string }) {
  return (
    <RequireRole role="fronter">
      <PageShell title="Active Call" actions={<LiveCallBadge />}>
        {/* Figma runs this as two equal columns on a 16px gutter, vertical and
            horizontal — not a fluid column beside a fixed-width rail. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <CallerLeadInfo />
            <QualificationChecklist />
          </div>
          <div className="space-y-4">
            <DispositionCard />
            <TransferPanel />
          </div>
        </div>
      </PageShell>
    </RequireRole>
  )
}
