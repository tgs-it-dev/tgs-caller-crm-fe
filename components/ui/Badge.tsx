'use client'

import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { alpha } from '@mui/material/styles'
import { tokens } from '@/lib/theme'

/**
 * `neutral`/`teal`/`red`/`amber` derive their fill from the text colour; the
 * rest carry fills measured off the Figma pills, which are all lighter than a
 * 10% alpha would give. `live` is the page-header pill — same signal red as
 * `signal`, but on paper rather than pink because it sits on the grey backdrop
 * instead of a white table row.
 */
const TONES = {
  neutral: { fg: tokens.slate, bg: alpha(tokens.slate, 0.1) },
  teal: { fg: tokens.status.green, bg: alpha(tokens.status.green, 0.1) },
  red: { fg: tokens.status.red, bg: alpha(tokens.status.red, 0.1) },
  amber: { fg: tokens.status.gold, bg: alpha(tokens.status.gold, 0.1) },
  signal: { fg: tokens.status.signalRed, bg: tokens.badge.ringing },
  caution: { fg: tokens.status.gold, bg: tokens.badge.waiting },
  live: { fg: tokens.status.signalRed, bg: tokens.paper },
  done: { fg: tokens.status.bayGreen, bg: tokens.badge.done },
} as const

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode
  tone?: keyof typeof TONES
  /** Leading status dot, per the Figma "Ringing"/"Live" pills. */
  dot?: boolean
}) {
  return (
    <Chip
      size="small"
      label={
        dot ? (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="span"
              aria-hidden
              sx={{ width: 8, height: 8, borderRadius: '9999px', bgcolor: 'currentColor' }}
            />
            {children}
          </Box>
        ) : (
          children
        )
      }
      sx={{
        bgcolor: TONES[tone].bg,
        color: TONES[tone].fg,
      }}
    />
  )
}
