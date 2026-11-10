import localFont from 'next/font/local'
import '../styles/globals.css'
import AppProviders from './providers/AppProviders'

// Inter's Latin variable font, kept in the repo so a build or dev server never has
// to reach Google Fonts, which can time out and stop the page loading.
const inter = localFont({
  src: './fonts/InterLatin.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
})

export const metadata = {
  title: 'TGS Caller CRM — Auto Warranty Campaign',
  description:
    'Sell more warranties. Lose fewer campaign leads. The sales-floor CRM that keeps every Auto Warranty Campaign with the team that bought it.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-paper font-sans text-ink">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
