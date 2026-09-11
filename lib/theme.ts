'use client'

import { alpha, createTheme } from '@mui/material/styles'

/** Design tokens mirrored from tailwind.config.js / Figma "CRM - Auto Warranty". */
export const tokens = {
  ink: '#1C2430',
  paper: '#FCFCFC',
  shopFloor: '#EEF0F1',
  slate: '#8A94A3',
  navy: '#1F3A5F',
  chrome: '#8A94A3',
  grey: '#BDBDBD',
  black: '#2C2C2C',
  status: {
    red: '#B5504A',
    green: '#4F8A5B',
    gold: '#C99A3E',
    blue: '#3E7CB1',
    /** Figma "Signal red" — the Queue "Ringing" pill. Deliberately not status.red. */
    signalRed: '#D64545',
    /** Figma "Bay green" — the Closers "Completed" pill. Deliberately not status.green. */
    bayGreen: '#2F8F5B',
  },
  /** Header/footer strips inside the Queue and Closers card tables. */
  strip: '#F8F8F8',
  /** Pill borders in the workspace "Phone Matched" / "Source" chips. */
  pillBorder: '#EFEFEF',
  /** Body copy color for the workspace lead-summary paragraph. */
  bodyText: '#656565',
  /** Figma "Light Grey" — Qualification Snapshot heading rule. */
  lightGrey: '#DCDCDC',
  /** Pill fills from Figma — all lighter than a 10% alpha of their text colour. */
  badge: {
    waiting: '#FCFBF2',
    ringing: '#FCF2F0',
    done: '#F3FBF7',
  },
} as const

const FIELD_SHADOW = '0 1px 2px 0 rgb(0 0 0 / 0.05)'

export const theme = createTheme({
  cssVariables: true,
  typography: {
    fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  palette: {
    mode: 'light',
    primary: {
      main: tokens.navy,
      contrastText: tokens.paper,
    },
    secondary: {
      main: tokens.slate,
      contrastText: tokens.ink,
    },
    error: { main: tokens.status.red },
    success: { main: tokens.status.green },
    warning: { main: tokens.status.gold },
    info: { main: tokens.status.blue },
    text: {
      primary: tokens.ink,
      secondary: tokens.slate,
    },
    background: {
      default: tokens.paper,
      paper: '#FFFFFF',
    },
    divider: tokens.slate,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minWidth: 0,
          gap: 8,
        },
        sizeMedium: {
          padding: '12px 16px',
          fontSize: '0.875rem',
        },
        sizeSmall: {
          padding: '8px 14px',
          fontSize: '13px',
        },
        // Scoped to the primary color class so a future destructive/contained
        // button still picks up its own palette entry.
        contained: {
          '&.MuiButton-colorPrimary': {
            backgroundColor: tokens.navy,
            color: tokens.paper,
            '&:hover': {
              backgroundColor: tokens.navy,
              opacity: 0.9,
            },
            '&.Mui-disabled': {
              backgroundColor: tokens.navy,
              color: tokens.paper,
              opacity: 0.5,
            },
          },
        },
        outlined: {
          backgroundColor: tokens.paper,
          borderColor: alpha(tokens.slate, 0.4),
          color: tokens.ink,
          fontWeight: 500,
          '&:hover': {
            backgroundColor: alpha(tokens.slate, 0.1),
            borderColor: alpha(tokens.slate, 0.4),
          },
          '&.Mui-disabled': {
            backgroundColor: alpha(tokens.slate, 0.1),
            color: tokens.slate,
          },
        },
      },
    },

    // Labels sit above their control across the whole app, so the shrink
    // animation and the notch in the outline are both turned off.
    MuiInputLabel: {
      defaultProps: {
        shrink: true,
      },
      styleOverrides: {
        root: {
          position: 'relative',
          transform: 'none',
          maxWidth: 'none',
          marginBottom: 12,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: tokens.black,
          '&.Mui-focused, &.Mui-error': {
            color: tokens.black,
          },
          '& .MuiFormLabel-asterisk': {
            display: 'none',
          },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          marginTop: 0,
          borderRadius: 8,
          backgroundColor: tokens.paper,
          boxShadow: FIELD_SHADOW,
          '& fieldset': {
            borderColor: tokens.chrome,
            '& legend': { display: 'none' },
          },
          '&:hover fieldset': {
            borderColor: tokens.chrome,
          },
          // 2px keeps focus a single border rather than a halo outside the
          // field. Navy rather than a mid-blue because the indicator has to
          // read as a *change* from the slate resting border: navy is 3.7:1
          // against slate, where status.blue managed only 1.45:1 and looked
          // near-identical to an unfocused field.
          '&.Mui-focused fieldset': {
            borderColor: tokens.navy,
            borderWidth: 2,
          },
          '&.MuiInputBase-multiline': {
            padding: 0,
          },
          '&.MuiInputBase-adornedEnd': {
            paddingRight: 12,
            '& .MuiInputBase-input': { paddingRight: 8 },
          },
        },
        input: {
          padding: '12px 16px',
          fontSize: '0.875rem',
          color: tokens.ink,
          '&::placeholder': {
            color: tokens.grey,
            opacity: 1,
          },
          // Chrome's autofill fill rendered these fields pale blue.
          '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus': {
            WebkitBoxShadow: `0 0 0 1000px ${tokens.paper} inset`,
            WebkitTextFillColor: tokens.ink,
            caretColor: tokens.ink,
            transition: 'background-color 9999s ease-out',
          },
        },
      },
    },

    MuiCheckbox: {
      defaultProps: {
        size: 'small',
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          padding: 0,
          color: alpha(tokens.slate, 0.55),
          '&.Mui-checked': { color: tokens.navy },
          '& .MuiSvgIcon-root': { fontSize: 18 },
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          alignItems: 'flex-start',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 8,
          fontSize: '0.875rem',
          '& .MuiAlert-icon': {
            padding: 0,
            margin: 0,
            marginTop: 2,
            color: 'inherit',
          },
          '& .MuiAlert-message': { padding: 0 },
        },
        colorError: {
          backgroundColor: alpha(tokens.status.red, 0.1),
          color: tokens.status.red,
          border: `1px solid ${alpha(tokens.status.red, 0.3)}`,
        },
      },
    },

    // Figma "Component 22" (Queue status pill): 24px tall, 9999px radius,
    // 2px/12px padding, 8px gap; text Inter Medium 12px / 170%.
    MuiChip: {
      styleOverrides: {
        root: {
          height: 'auto',
          minHeight: 24,
          borderRadius: 9999,
        },
        label: {
          padding: '2px 12px',
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.7,
        },
      },
    },

    // Every card table in this design shares one shape: a 37px grey header
    // strip, white body rows split by hairlines, and a matching footer strip
    // holding the pagination. `separate` collapsing is what lets the strips
    // keep their 6px radius — with `collapse`, cell corners don't round.
    MuiTable: {
      styleOverrides: {
        root: {
          borderCollapse: 'separate',
          borderSpacing: 0,
          tableLayout: 'fixed',
          '& thead th': {
            backgroundColor: tokens.strip,
            border: 0,
          },
          '& thead th:first-of-type': { borderRadius: '6px 0 0 6px' },
          '& thead th:last-of-type': { borderRadius: '0 6px 6px 0' },
          '& tbody td': { borderBottom: `0.5px solid ${tokens.slate}` },
          '& tbody tr:last-of-type td': { borderBottom: 0 },
        },
      },
    },

    // Header cells are Inter Medium 14px/150% in "Diagnostic ink", which lands
    // a 21px line box inside the strip's 8px padding for a 37px total.
    // Body copy sits on `black`, not `ink` — this design file distinguishes the
    // two, so don't collapse them.
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: tokens.slate,
          fontSize: '0.875rem',
          lineHeight: 1.5,
        },
        head: {
          padding: '8px 24px',
          fontWeight: 500,
          color: tokens.ink,
          borderBottom: 0,
        },
        body: {
          padding: '20px 24px',
          color: tokens.black,
        },
      },
    },
  },
})
