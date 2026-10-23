/** Mirrors components/ui/Checkbox so the radio rows line up with a checkbox list. */
export const RADIO_ROW_SX = {
  m: 0,
  gap: 1.25,
  alignItems: 'flex-start',
  '& .MuiFormControlLabel-label': { fontSize: '0.875rem', lineHeight: '20px' },
} as const

/**
 * What the theme already does for MuiCheckbox, which has no MuiRadio twin.
 *
 * Left at MUI's defaults a radio carries 9px of padding around a 24px glyph, so
 * beside a themed 18px checkbox it reads as a different control, and against a
 * 20px line the extra padding drops its centre 11px below its own label. Set
 * here rather than in the theme because the qualification checklist's radios are
 * not ours to restyle.
 */
export const RADIO_CONTROL_SX = {
  mt: '2px',
  p: 0,
  '& .MuiSvgIcon-root': { fontSize: 18 },
} as const
