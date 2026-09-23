'use client'

import { useId, type ReactNode } from 'react'
import MuiDialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { tokens } from '@/lib/theme'

/**
 * A modal that holds one short task, with the page still behind it.
 *
 * Deliberately empty of form logic: it owns the frame, the heading and the
 * footer, and nothing about what sits inside.
 */
export function Dialog({
  open,
  title,
  onClose,
  busy = false,
  actions,
  children,
}: {
  open: boolean
  title: string
  /** Escape and the backdrop both route here — and are ignored while `busy`. */
  onClose: () => void
  /** Something is in flight: closing now would lose the answer to it. */
  busy?: boolean
  actions?: ReactNode
  children: ReactNode
}) {
  const titleId = useId()

  return (
    <MuiDialog
      open={open}
      onClose={() => {
        if (!busy) onClose()
      }}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { sx: { borderRadius: '12px', padding: '4px' } } }}
    >
      <DialogTitle
        id={titleId}
        sx={{ fontSize: 18, fontWeight: 500, lineHeight: 1.2, color: tokens.ink, paddingBottom: 1 }}
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ paddingBottom: 1 }}>{children}</DialogContent>
      {actions && <DialogActions sx={{ padding: '8px 24px 20px' }}>{actions}</DialogActions>}
    </MuiDialog>
  )
}
