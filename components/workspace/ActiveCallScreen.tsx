'use client'

import { useEffect, useState } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-status-red">
        <span className="h-1.5 w-1.5 rounded-full bg-status-red" />
        Live
      </span>
      <span className="text-sm text-ink">on call — {formatElapsed(elapsed)}</span>
    </div>
  )
}

export function ActiveCallScreen({ interactionId }: { interactionId: string }) {
  return (
    <RequireRole role="fronter">
      <main className="min-h-screen bg-shop-floor">
        <div
          className="border-b border-slate px-6 py-6"
          style={{ borderBottomWidth: '0.5px' }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Active Call</h1>
            <LiveCallBadge />
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-8">
              <CallerLeadInfo />
              <QualificationChecklist />
            </div>
            <div className="space-y-8">
              <DispositionCard />
              <TransferPanel interactionId={interactionId} />
            </div>
          </div>
        </div>
      </main>
    </RequireRole>
  )
}
