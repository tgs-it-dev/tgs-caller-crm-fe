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
  titleAside,
  onClose,
  busy = false,
  dismissible = false,
  maxWidth = 'xs',
  actions,
  children,
}: {
  open: boolean
  title: string
  /** Sits opposite the title, such as a status badge. */
  titleAside?: ReactNode
  /**
   * Called from Cancel (and other explicit actions). Backdrop and Escape do
   * not close — a half-filled CRM form must not dismiss on a stray click.
   */
  onClose: () => void
  /** Something is in flight: closing now would lose the answer to it. */
  busy?: boolean
  /** Nothing to lose, as in a read-only view, so the backdrop and Escape close it too. */
  dismissible?: boolean
  /** `sm` for content that needs the room, such as a table of results. */
  maxWidth?: 'xs' | 'sm'
  actions?: ReactNode
  children: ReactNode
}) {
  const titleId = useId()

  return (
    <MuiDialog
      open={open}
      onClose={(_event, reason) => {
        if (busy) return
        // Only the Cancel action (or equivalent) should dismiss — never the
        // dimmed overlay or Escape mid-form.
        if (!dismissible && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return
        onClose()
      }}
      aria-labelledby={titleId}
      fullWidth
      maxWidth={maxWidth}
      slotProps={{ paper: { sx: { borderRadius: '12px', padding: '4px' } } }}
    >
      <DialogTitle
        id={titleId}
        sx={{ fontSize: 18, fontWeight: 500, lineHeight: 1.2, color: tokens.ink, paddingBottom: 1 }}
      >
        {titleAside ? (
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0 break-words">{title}</span>
            <span className="shrink-0">{titleAside}</span>
          </span>
        ) : (
          title
        )}
      </DialogTitle>
      <DialogContent sx={{ paddingBottom: 1 }}>{children}</DialogContent>
      {actions && <DialogActions sx={{ padding: '8px 24px 20px' }}>{actions}</DialogActions>}
    </MuiDialog>
  )
}
