'use client'

import {
  ChangeEventHandler,
  FocusEventHandler,
  SelectHTMLAttributes,
  forwardRef,
  useId,
} from 'react'
import TextField from '@mui/material/TextField'
import { fieldSx } from '@/lib/fieldSx'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, id, className = '', children, onChange, onBlur, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <TextField
      id={inputId}
      label={label}
      select
      fullWidth
      variant="outlined"
      className={className}
      value={props.value ?? ''}
      defaultValue={props.defaultValue}
      name={props.name}
      disabled={props.disabled}
      required={props.required}
      onChange={onChange as unknown as ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>}
      onBlur={onBlur as unknown as FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>}
      slotProps={{
        inputLabel: label ? { shrink: true, required: false } : undefined,
        select: {
          native: true,
          inputRef: ref,
          'aria-label': props['aria-label'],
        },
      }}
      sx={fieldSx()}
    >
      {children}
    </TextField>
  )
})
