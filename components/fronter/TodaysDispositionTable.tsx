'use client'

import { DataTable, type DataColumn } from '@/components/ui/DataTable'
import {
  formatDispositionTime,
  type TodaysDispositionRow,
} from '@/lib/fronterStats'

const columns: DataColumn<TodaysDispositionRow>[] = [
  {
    id: 'time',
    header: 'Time',
    render: (row) => formatDispositionTime(row.created_at),
  },
  {
    id: 'lead',
    header: 'Lead',
    render: (row) => (
      <>
        <span className="block font-medium text-black">{row.lead_name}</span>
        <span className="mt-1 block text-xs leading-[150%] text-body-text">
          {row.lead_phone}
        </span>
      </>
    ),
  },
  {
    id: 'disposition',
    header: 'Disposition',
    render: (row) => row.label,
  },
]

/** Figma Fronter My Stats — columns only; shell lives in `DataTable`. */
export function TodaysDispositionTable({ rows }: { rows: TodaysDispositionRow[] }) {
  return (
    <DataTable
      title="Today's Disposition"
      ariaLabel="Today's dispositions"
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      emptyMessage="No dispositions recorded today."
    />
  )
}
