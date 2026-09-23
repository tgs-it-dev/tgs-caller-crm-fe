'use client'

import { Alert } from '@/components/ui/Alert'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import type { TodaysDispositionRow } from '@/lib/closer'

const columns: DataColumn<TodaysDispositionRow>[] = [
  {
    id: 'from',
    header: 'From',
    render: (row) => (
      <>
        <span className="font-medium text-black">{row.from_name}</span>
        {row.disposition_label && (
          <p className="mt-1 text-xs leading-[150%] text-body-text">{row.disposition_label}</p>
        )}
      </>
    ),
  },
  {
    id: 'interaction',
    header: 'Interaction ID',
    render: (row) => (
      <span className="font-mono text-sm text-black">{row.interaction_id}</span>
    ),
  },
  {
    id: 'accepted',
    header: 'Accepted',
    render: (row) => row.accepted_at ?? '—',
  },
]

/** Closer Active Call — same `DataTable` shell, closer column set. */
export function TodaysDispositionTable({
  rows,
  isLoading = false,
  error = null,
}: {
  rows: TodaysDispositionRow[]
  isLoading?: boolean
  error?: string | null
}) {
  if (error) {
    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-ink">Today&apos;s Disposition</h2>
        <Alert>{error}</Alert>
      </div>
    )
  }

  if (isLoading) {
    return (
      <DataTable
        title="Today's Disposition"
        ariaLabel="Today's dispositions"
        rows={[]}
        columns={columns}
        getRowId={(row) => row.interaction_id}
        emptyMessage="Loading today's dispositions…"
      />
    )
  }

  return (
    <DataTable
      title="Today's Disposition"
      ariaLabel="Today's dispositions"
      rows={rows}
      columns={columns}
      getRowId={(row) => row.interaction_id}
      emptyMessage="No accepted transfers yet today."
    />
  )
}
