'use client'

import { ReactNode } from 'react'
import Chip from '@mui/material/Chip'
import { alpha } from '@mui/material/styles'
import { tokens } from '@/lib/theme'

const TONES = {
  neutral: tokens.slate,
  teal: tokens.status.green,
  red: tokens.status.red,
  amber: tokens.status.gold,
} as const

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: keyof typeof TONES
}) {
  return (
    <Chip
      size="small"
      label={children}
      sx={{
        bgcolor: alpha(TONES[tone], 0.1),
        color: TONES[tone],
      }}
    />
  )
}
