import type { Metadata } from 'next'
import { CurrentUserProvider } from '@/components/auth/CurrentUserProvider'
import { Sidebar } from '@/components/dashboard/Sidebar'

export const metadata: Metadata = {
  title: 'Admin — TGS Caller CRM',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrentUserProvider>
      <div className="flex h-screen bg-shop-floor">
        <Sidebar role="administrator" />
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </CurrentUserProvider>
  )
}
