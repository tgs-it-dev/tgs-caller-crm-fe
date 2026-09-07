'use client'

import { ChangeEvent, InputHTMLAttributes, forwardRef, useId } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import MuiCheckbox from '@mui/material/Checkbox'
import { tokens } from '@/lib/theme'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'color'> & {
  label: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, id, className = '', checked, defaultChecked, disabled, onChange, name, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <FormControlLabel
      sx={{
        m: 0,
        gap: 1.25,
        alignItems: 'flex-start',
        '& .MuiFormControlLabel-label': {
          fontSize: '0.875rem',
          lineHeight: '20px',
          color: tokens.ink,
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
          size="small"
          disableRipple
          sx={{
            p: 0,
            mt: '2px',
            color: 'rgba(138, 148, 163, 0.55)',
            '&.Mui-checked': { color: tokens.navy },
            '& .MuiSvgIcon-root': { fontSize: 18 },
          }}
          slotProps={{ input: { ...props, ref } }}
        />
      }
      label={label}
    />
  )
})
