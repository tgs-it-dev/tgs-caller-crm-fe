'use client'

import Link from 'next/link'
import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import type { TodaysDispositionRow } from '@/lib/closer'

const columns: DataColumn<TodaysDispositionRow>[] = [
  {
    id: 'from',
    header: 'From',
    render: (row) => (
      <>
        <Link
          href={`/closer/workspace/${row.interaction_id}`}
          className="font-medium text-navy underline hover:text-black"
        >
          {row.from_name}
        </Link>
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
    render: (row) => row.accepted_at,
  },
]

/** Closer Active Call — same `DataTable` shell, closer column set. */
export function TodaysDispositionTable({ rows }: { rows: TodaysDispositionRow[] }) {
  return (
    <DataTable
      title="Today's Disposition"
      ariaLabel="Today's dispositions"
      rows={rows}
      columns={columns}
      getRowId={(row) => row.transfer_id}
      emptyMessage="No accepted transfers yet today."
    />
  )
}
