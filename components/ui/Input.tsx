'use client'

import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import { fieldSx } from '@/lib/fieldSx'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  endAdornment?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, className = '', endAdornment, type = 'text', ...props },
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
      className={className}
      inputRef={ref}
      placeholder={props.placeholder}
      value={props.value}
      defaultValue={props.defaultValue}
      name={props.name}
      autoComplete={props.autoComplete}
      disabled={props.disabled}
      required={props.required}
      onChange={props.onChange}
      onBlur={props.onBlur}
      onFocus={props.onFocus}
      slotProps={{
        // Keep the input required for validation but drop MUI's asterisk —
        // the Figma labels have none.
        inputLabel: { shrink: true, required: false },
        htmlInput: {
          'aria-label': props['aria-label'],
          minLength: props.minLength,
        },
        input: {
          endAdornment: endAdornment ? (
            <InputAdornment position="end">{endAdornment}</InputAdornment>
          ) : undefined,
        },
      }}
      sx={fieldSx({ hasEndAdornment: Boolean(endAdornment) })}
    />
  )
})
