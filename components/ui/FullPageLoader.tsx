'use client'

import CircularProgress from '@mui/material/CircularProgress'
import { tokens } from '@/lib/theme'

/**
 * Full-viewport loader for route transitions, hard refresh, and auth checks.
 * Uses MUI CircularProgress with the CRM navy primary on paper.
 */
export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-screen flex-col items-center justify-center gap-3 bg-paper"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <CircularProgress
        size={40}
        thickness={4}
        sx={{ color: tokens.navy }}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}
