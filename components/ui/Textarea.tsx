'use client'

import { TextareaHTMLAttributes, forwardRef, useId } from 'react'
import TextField from '@mui/material/TextField'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    id,
    className,
    rows = 3,
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    name,
    placeholder,
    disabled,
    required,
    ...htmlTextareaProps
  },
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
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      onBlur={onBlur}
      onFocus={onFocus}
      name={name}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      slotProps={{
        htmlInput: htmlTextareaProps,
      }}
    />
  )
})
