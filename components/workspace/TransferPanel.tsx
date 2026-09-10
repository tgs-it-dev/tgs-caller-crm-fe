'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { ClosersTable, MOCK_CLOSERS } from './ClosersTable'
import { OverrideReason } from './OverrideReason'

const TOTAL_PAGES = 10

export function TransferPanel() {
  const [page, setPage] = useState(1)
  const [overrideReason, setOverrideReason] = useState('')

  return (
    <div className="rounded-xl border-hairline border-slate bg-white p-6">
      <h2 className="border-b border-slate/20 pb-4 text-lg font-medium leading-[120%] text-ink">Transfer</h2>

      <p className="mt-4 text-sm font-medium text-ink">Available Closers</p>
      <div className="mt-3">
        <ClosersTable closers={MOCK_CLOSERS} />
        <div className="flex h-[37px] items-center rounded-md bg-table-strip px-6">
          <Pagination
            className="w-full"
            page={page}
            totalPages={TOTAL_PAGES}
            rangeStart={1}
            rangeEnd={MOCK_CLOSERS.length}
            onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => Math.min(TOTAL_PAGES, prev + 1))}
          />
        </div>
      </div>

      <div className="mt-5">
        <Button type="button" disabled className="cursor-not-allowed bg-slate/40">
          Transfer to Closer
        </Button>
        <p className="mt-2 text-center text-xs text-slate">
          Add an override reason if the checklist isn&apos;t complete.
        </p>
      </div>

      <OverrideReason reason={overrideReason} onReasonChange={setOverrideReason} />
    </div>
  )
}
