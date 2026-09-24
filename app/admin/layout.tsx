import type { Metadata } from 'next'
import { Sidebar } from '@/components/dashboard/Sidebar'

export const metadata: Metadata = {
  title: 'Admin — TGS Caller CRM',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-shop-floor">
      <Sidebar />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
