'use client'

import { ReactNode } from 'react'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@/lib/theme'
import MockProvider from './MockProvider'

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    // `prepend` puts Emotion's styles above Tailwind's stylesheet, so Tailwind
    // utilities passed via `className` still win over MUI's own styles.
    // Do NOT use `enableCssLayer` here: that's the Tailwind v4 integration, and
    // on v3 (unlayered output) it makes every MUI style lose to preflight.
    <AppRouterCacheProvider options={{ prepend: true }}>
      <ThemeProvider theme={theme}>
        <MockProvider>{children}</MockProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  )
}
