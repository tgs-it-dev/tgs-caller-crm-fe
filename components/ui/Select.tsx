'use client'

import {
  ChangeEventHandler,
  FocusEventHandler,
  SelectHTMLAttributes,
  forwardRef,
  useId,
} from 'react'
import TextField from '@mui/material/TextField'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    id,
    className,
    children,
    value,
    defaultValue,
    onChange,
    onBlur,
    name,
    disabled,
    required,
    ...htmlSelectProps
  },
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
      value={value}
      defaultValue={defaultValue}
      // The rendered control is a native <select>, so the public handler types
      // are accurate even though MUI types them against its own input.
      onChange={onChange as unknown as ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>}
      onBlur={onBlur as unknown as FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>}
      name={name}
      disabled={disabled}
      required={required}
      slotProps={{
        htmlInput: htmlSelectProps,
        select: {
          native: true,
          inputRef: ref,
        },
      }}
    >
      {children}
    </TextField>
  )
})
