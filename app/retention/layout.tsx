import type { Metadata } from 'next'
import { Sidebar } from '@/components/dashboard/Sidebar'

export const metadata: Metadata = {
  title: 'Retention - TGS Caller CRM',
}

export default function RetentionLayout({ children }: { children: React.ReactNode }) {
  // Kept out of document flow, as the QA desk is, so the sidebar never scrolls the body.
  return (
    <div className="fixed inset-0 flex overflow-hidden overscroll-none bg-shop-floor">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-none">
        {children}
      </div>
    </div>
  )
}
