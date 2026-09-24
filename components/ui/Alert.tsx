'use client'

import { ReactNode } from 'react'
import MuiAlert from '@mui/material/Alert'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

export function Alert({ children }: { children: ReactNode }) {
  return (
    <MuiAlert
      severity="error"
      variant="standard"
      icon={<WarningAmberRoundedIcon sx={{ fontSize: 16 }} />}
      role="alert"
      sx={{ mb: 2.5 }}
    >
      {children}
    </MuiAlert>
  )
}
