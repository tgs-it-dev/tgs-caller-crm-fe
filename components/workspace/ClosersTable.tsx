'use client'

import Radio from '@mui/material/Radio'
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

/**
 * Same radio sizing as UserFormDialog — MUI's default padding sits wrong
 * beside a 20px table row label.
 */
const RADIO_SX = {
  p: 0,
  '& .MuiSvgIcon-root': { fontSize: 18 },
} as const

export function ClosersTable({
  closers,
  selectedUserId,
  onSelect,
  disabled = false,
}: {
  closers: AvailableCloserItem[]
  /** `null` = auto-assign (any free closer). */
  selectedUserId: string | null
  onSelect: (userId: string | null) => void
  disabled?: boolean
}) {
  return (
    <Table
      aria-label="Available closers"
      // These rows are single-line, so Figma runs them at 16px vertical
      // padding (52px rows) instead of the 20px the two-line Queue rows take.
      sx={{ '& tbody td': { paddingTop: '16px', paddingBottom: '16px' } }}
    >
      <TableHead>
        <TableRow>
          <TableCell scope="col" padding="checkbox" />
          <TableCell scope="col">Name</TableCell>
          <TableCell scope="col" align="right">
            Status
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {closers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-slate">
              No closers available right now.
            </TableCell>
          </TableRow>
        ) : (
          closers.map((closer) => {
            const free = closer.status === 'available'
            const selected = selectedUserId === closer.user_id
            return (
              <TableRow
                key={closer.user_id}
                hover={free && !disabled}
                selected={selected}
                onClick={() => {
                  if (disabled || !free) return
                  // Clicking the selected row again clears the pin → auto-assign.
                  onSelect(selected ? null : closer.user_id)
                }}
                sx={{
                  cursor: free && !disabled ? 'pointer' : 'default',
                  ...(free && !disabled ? undefined : { opacity: 0.72 }),
                }}
              >
                <TableCell padding="checkbox">
                  <Radio
                    size="small"
                    color="primary"
                    disableRipple
                    checked={selected}
                    disabled={disabled || !free}
                    value={closer.user_id}
                    inputProps={{
                      'aria-label': `Pin transfer to ${closer.name}`,
                    }}
                    onChange={() => onSelect(closer.user_id)}
                    onClick={(event) => event.stopPropagation()}
                    sx={RADIO_SX}
                  />
                </TableCell>
                <TableCell>{closer.name}</TableCell>
                <TableCell align="right">
                  <Badge tone={STATUS_TONE[closer.status]}>{STATUS_LABEL[closer.status]}</Badge>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
