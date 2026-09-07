'use client'

import { ButtonHTMLAttributes } from 'react'
import MuiButton from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { tokens } from '@/lib/theme'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & {
  isLoading?: boolean
  loadingText?: string
  variant?: 'primary' | 'secondary'
  size?: 'default' | 'small'
}

export function Button({
  isLoading = false,
  loadingText,
  variant = 'primary',
  size = 'default',
  children,
  disabled,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary'

  return (
    <MuiButton
      type={type}
      fullWidth
      disableElevation
      variant={isPrimary ? 'contained' : 'outlined'}
      disabled={disabled || isLoading}
      className={className}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        borderRadius: '8px',
        fontWeight: 600,
        textTransform: 'none',
        minWidth: 0,
        ...(size === 'small'
          ? { px: 1.75, py: 1, fontSize: '13px' }
          : { px: 2, py: 1.5, fontSize: '0.875rem' }),
        ...(isPrimary
          ? {
              bgcolor: tokens.navy,
              color: tokens.paper,
              '&:hover': { bgcolor: tokens.navy, opacity: 0.9 },
              '&.Mui-disabled': {
                bgcolor: tokens.navy,
                color: tokens.paper,
                opacity: 0.5,
              },
            }
          : {
              bgcolor: tokens.paper,
              color: tokens.ink,
              border: '1px solid rgba(138, 148, 163, 0.4)',
              '&:hover': {
                bgcolor: 'rgba(138, 148, 163, 0.1)',
                border: '1px solid rgba(138, 148, 163, 0.4)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(138, 148, 163, 0.1)',
                color: tokens.slate,
              },
            }),
      }}
      {...props}
    >
      {isLoading && <CircularProgress size={16} color="inherit" aria-hidden />}
      {isLoading ? loadingText ?? children : children}
    </MuiButton>
  )
}
