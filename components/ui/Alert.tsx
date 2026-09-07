'use client'

import { ReactNode } from 'react'
import MuiAlert from '@mui/material/Alert'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { tokens } from '@/lib/theme'

export function Alert({ children }: { children: ReactNode }) {
  return (
    <MuiAlert
      severity="error"
      variant="standard"
      icon={<WarningAmberRoundedIcon sx={{ fontSize: 16 }} />}
      role="alert"
      sx={{
        mb: 2.5,
        alignItems: 'flex-start',
        gap: 1,
        px: 1.5,
        py: 1.25,
        borderRadius: '8px',
        border: '1px solid rgba(181, 80, 74, 0.3)',
        bgcolor: 'rgba(181, 80, 74, 0.1)',
        color: tokens.status.red,
        fontSize: '0.875rem',
        '& .MuiAlert-icon': { p: 0, m: 0, mt: '2px', color: 'inherit' },
        '& .MuiAlert-message': { p: 0 },
      }}
    >
      {children}
    </MuiAlert>
  )
}
