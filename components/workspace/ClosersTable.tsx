'use client'

import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { Badge } from '@/components/ui/Badge'

export type Closer = {
  id: string
  name: string
  dateRange: string
  status: string
}

export const MOCK_CLOSERS: Closer[] = [
  { id: '1', name: 'Mubeen N.', dateRange: '08.08.2026', status: 'Completed' },
  { id: '2', name: 'Mubeen N.', dateRange: '08.08.2026', status: 'Completed' },
  { id: '3', name: 'Mubeen N.', dateRange: '08.08.2026', status: 'Completed' },
  { id: '4', name: 'Mubeen N.', dateRange: '08.08.2026', status: 'Completed' },
  { id: '5', name: 'Mubeen N.', dateRange: '08.08.2026', status: 'Completed' },
]

export function ClosersTable({ closers }: { closers: Closer[] }) {
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
          <TableCell scope="col" align="center">
            Date Range
          </TableCell>
          <TableCell scope="col" align="right">
            Status
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {closers.map((closer) => (
          <TableRow key={closer.id}>
            <TableCell>{closer.name}</TableCell>
            <TableCell align="center">{closer.dateRange}</TableCell>
            <TableCell align="right">
              <Badge tone="done">{closer.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
