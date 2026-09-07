'use client'

import { TextareaHTMLAttributes, forwardRef, useId } from 'react'
import TextField from '@mui/material/TextField'
import { fieldSx } from '@/lib/fieldSx'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, id, className = '', rows = 3, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <TextField
      id={inputId}
      label={label}
      multiline
      fullWidth
      variant="outlined"
      rows={rows}
      className={className}
      inputRef={ref}
      placeholder={props.placeholder}
      value={props.value}
      defaultValue={props.defaultValue}
      name={props.name}
      disabled={props.disabled}
      required={props.required}
      onChange={props.onChange}
      onBlur={props.onBlur}
      slotProps={{
        inputLabel: label ? { shrink: true, required: false } : undefined,
      }}
      sx={fieldSx({ multiline: true })}
    />
  )
})
