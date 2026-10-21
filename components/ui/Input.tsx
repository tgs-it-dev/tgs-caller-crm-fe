'use client'

import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Omit in card headers — same as Select — so the control lines up with `small` buttons. */
  label?: ReactNode
  startAdornment?: ReactNode
  endAdornment?: ReactNode
  /** `small` matches the `small` Button / Select, for controls sat in a card header. */
  size?: 'default' | 'small'
  /** Marks the field at fault — pair it with `helperText` saying what to fix. */
  error?: boolean
  helperText?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    id,
    className,
    startAdornment,
    endAdornment,
    size = 'default',
    // Destructured rather than spread: neither is a DOM attribute, and MUI
    // wants both on the wrapper.
    error,
    helperText,
    type = 'text',
    // Props MUI needs on the wrapper to drive its own disabled/required state;
    // everything else goes straight to the <input>.
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    name,
    placeholder,
    autoComplete,
    autoFocus,
    disabled,
    required,
    ...htmlInputProps
  },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <TextField
      id={inputId}
      label={label}
      type={type}
      fullWidth
      variant="outlined"
      size={size === 'small' ? 'small' : 'medium'}
      className={className}
      // Helper and error text line up with the field, not with MUI's default inset.
      sx={{ '& .MuiFormHelperText-root': { marginLeft: 0, marginRight: 0 } }}
      inputRef={ref}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      onBlur={onBlur}
      onFocus={onFocus}
      name={name}
      placeholder={placeholder}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      disabled={disabled}
      required={required}
      error={error}
      helperText={helperText}
      slotProps={{
        htmlInput: {
          ...htmlInputProps,
          // Card-header fields omit the visible label; keep a name for AT.
          ...((label == null || label === '') &&
          !('aria-label' in htmlInputProps) &&
          typeof placeholder === 'string'
            ? { 'aria-label': placeholder }
            : {}),
        },
        input: {
          startAdornment: startAdornment ? (
            <InputAdornment position="start">{startAdornment}</InputAdornment>
          ) : undefined,
          endAdornment: endAdornment ? (
            <InputAdornment position="end">{endAdornment}</InputAdornment>
          ) : undefined,
        },
      }}
    />
  )
})
