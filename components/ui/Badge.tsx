'use client'

import { ReactNode } from 'react'
import Chip from '@mui/material/Chip'

const TONE_SX = {
  neutral: { bgcolor: 'rgba(138, 148, 163, 0.1)', color: '#8A94A3' },
  teal: { bgcolor: 'rgba(79, 138, 91, 0.1)', color: '#4F8A5B' },
  red: { bgcolor: 'rgba(181, 80, 74, 0.1)', color: '#B5504A' },
  amber: { bgcolor: 'rgba(201, 154, 62, 0.1)', color: '#C99A3E' },
} as const

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: keyof typeof TONE_SX
}) {
  return (
    <Chip
      size="small"
      label={children}
      sx={{
        ...TONE_SX[tone],
        height: 'auto',
        borderRadius: '9999px',
        '& .MuiChip-label': {
          px: 1.25,
          py: '2px',
          fontSize: '0.75rem',
          fontWeight: 500,
          lineHeight: '16px',
        },
      }}
    />
  )
}
