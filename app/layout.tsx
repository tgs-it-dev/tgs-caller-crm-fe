import { Inter } from 'next/font/google'
import '../styles/globals.css'
import AppProviders from './providers/AppProviders'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata = {
  title: 'Auto Warranty CRM',
  description: 'Frontend scaffold for Auto Warranty CRM'
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
