import type { SxProps, Theme } from '@mui/material/styles'
import { tokens } from './theme'

/**
 * Shared MUI `sx` for text-like fields so `Input`, `Select` and `Textarea`
 * render identically to the Tailwind form styling in the Figma file:
 * label above the control, 8px radius, chrome border, paper fill.
 */
export function fieldSx({
  hasEndAdornment = false,
  multiline = false,
}: { hasEndAdornment?: boolean; multiline?: boolean } = {}): SxProps<Theme> {
  return {
    '& .MuiInputLabel-root': {
      position: 'relative',
      transform: 'none',
      maxWidth: 'none',
      mb: '6px',
      fontSize: '0.875rem',
      fontWeight: 500,
      color: tokens.black,
      '&.Mui-focused, &.Mui-error': { color: tokens.black },
    },
    '& .MuiOutlinedInput-root': {
      mt: 0,
      borderRadius: '8px',
      bgcolor: tokens.paper,
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      ...(multiline ? { p: 0 } : {}),
      '& fieldset': {
        borderColor: tokens.chrome,
        // The label sits outside the control, so the notch would be dead space.
        '& legend': { display: 'none' },
      },
      '&:hover fieldset': { borderColor: tokens.chrome },
      '&.Mui-focused fieldset': {
        borderColor: tokens.status.blue,
        borderWidth: '1px',
      },
      // Focus recolors the border only — a box-shadow ring here reads as a
      // second border outside the field.
      '&.Mui-focused': {
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
    },
    '& .MuiInputBase-input': {
      px: 2,
      py: '12px',
      ...(hasEndAdornment ? { pr: 1 } : {}),
      fontSize: '0.875rem',
      color: tokens.ink,
      '&::placeholder': { color: tokens.grey, opacity: 1 },
      // Chrome's autofill fill was rendering these fields pale blue.
      '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus': {
        WebkitBoxShadow: `0 0 0 1000px ${tokens.paper} inset`,
        WebkitTextFillColor: tokens.ink,
        caretColor: tokens.ink,
        transition: 'background-color 9999s ease-out',
      },
    },
  }
}
