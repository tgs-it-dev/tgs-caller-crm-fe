'use client'

import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { Badge } from '@/components/ui/Badge'
import type { AvailableCloserItem } from '@/lib/transfers'

const STATUS_LABEL: Record<AvailableCloserItem['status'], string> = {
  available: 'Available',
  on_call: 'On Call',
}

const STATUS_TONE: Record<AvailableCloserItem['status'], 'done' | 'caution'> = {
  available: 'done',
  on_call: 'caution',
}

export function ClosersTable({ closers }: { closers: AvailableCloserItem[] }) {
  return (
    <Table
      aria-label="Available closers"
      // These rows are single-line, so Figma runs them at 16px vertical
      // padding (52px rows) instead of the 20px the two-line Queue rows take.
      sx={{ '& tbody td': { paddingTop: '16px', paddingBottom: '16px' } }}
    >
      <TableHead>
        <TableRow>
          <TableCell scope="col">Name</TableCell>
          <TableCell scope="col" align="right">
            Status
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {closers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={2} className="text-slate">
              No closers available right now.
            </TableCell>
          </TableRow>
        ) : (
          closers.map((closer) => (
            <TableRow key={closer.user_id}>
              <TableCell>{closer.name}</TableCell>
              <TableCell align="right">
                <Badge tone={STATUS_TONE[closer.status]}>{STATUS_LABEL[closer.status]}</Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
