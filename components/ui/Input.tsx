'use client'

import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  endAdornment?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    id,
    className,
    endAdornment,
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
      className={className}
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
      slotProps={{
        htmlInput: htmlInputProps,
        input: {
          endAdornment: endAdornment ? (
            <InputAdornment position="end">{endAdornment}</InputAdornment>
          ) : undefined,
        },
      }}
    />
  )
})
