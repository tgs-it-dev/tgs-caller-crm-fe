'use client'

import { ButtonHTMLAttributes } from 'react'
import MuiButton from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

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
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <MuiButton
      type={type}
      fullWidth
      variant={variant === 'primary' ? 'contained' : 'outlined'}
      color="primary"
      size={size === 'small' ? 'small' : 'medium'}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={className}
      {...props}
    >
      {isLoading && <CircularProgress size={16} color="inherit" aria-hidden />}
      {isLoading ? loadingText ?? children : children}
    </MuiButton>
  )
}
