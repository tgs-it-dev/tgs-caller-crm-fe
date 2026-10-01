import { Inter } from 'next/font/google'
import '../styles/globals.css'
import AppProviders from './providers/AppProviders'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

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
