'use client'

import { createTheme } from '@mui/material/styles'

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
  },
} as const

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
    error: {
      main: tokens.status.red,
    },
    success: {
      main: tokens.status.green,
    },
    warning: {
      main: tokens.status.gold,
    },
    info: {
      main: tokens.status.blue,
    },
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
          fontSize: '0.875rem',
        },
        sizeMedium: {
          padding: '12px 16px',
        },
        sizeSmall: {
          padding: '8px 14px',
          fontSize: '13px',
        },
        outlined: {
          borderColor: 'rgba(138, 148, 163, 0.4)',
          color: tokens.ink,
          backgroundColor: tokens.paper,
          '&:hover': {
            borderColor: 'rgba(138, 148, 163, 0.4)',
            backgroundColor: 'rgba(138, 148, 163, 0.1)',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.paper,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.chrome,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.chrome,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: tokens.status.blue,
            borderWidth: 1,
          },
        },
        input: {
          fontSize: '0.875rem',
          color: tokens.ink,
          padding: '12px 16px',
          '&::placeholder': {
            color: tokens.grey,
            opacity: 1,
          },
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          fontWeight: 500,
          color: tokens.black,
          marginBottom: 6,
          '&.Mui-focused': {
            color: tokens.black,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: '0.875rem',
        },
        colorError: {
          backgroundColor: 'rgba(181, 80, 74, 0.1)',
          color: tokens.status.red,
          border: '1px solid rgba(181, 80, 74, 0.3)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: '0.75rem',
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: 'rgba(138, 148, 163, 0.4)',
          padding: 0,
          '&.Mui-checked': {
            color: tokens.navy,
          },
        },
      },
    },
  },
})
