'use client'

import { ChangeEvent, InputHTMLAttributes, forwardRef, useId } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import MuiCheckbox from '@mui/material/Checkbox'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'color'> & {
  label: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, id, className, checked, defaultChecked, disabled, onChange, name, ...htmlInputProps },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <FormControlLabel
      // Top-aligned so multi-line labels read correctly. Kept local rather
      // than themed because MuiFormControlLabel also backs the radio rows.
      sx={{
        m: 0,
        gap: 1.25,
        alignItems: 'flex-start',
        '& .MuiFormControlLabel-label': {
          fontSize: '0.875rem',
          lineHeight: '20px',
        },
      }}
      control={
        <MuiCheckbox
          id={inputId}
          name={name}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={onChange as (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void}
          className={className}
          sx={{ mt: '2px' }}
          slotProps={{ input: { ...htmlInputProps, ref } }}
        />
      }
      label={label}
    />
  )
})
