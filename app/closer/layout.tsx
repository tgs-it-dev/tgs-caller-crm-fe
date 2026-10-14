import { Sidebar } from '@/components/dashboard/Sidebar'

export default function CloserLayout({ children }: { children: React.ReactNode }) {
  // fixed inset-0 keeps the desk out of document flow so wheel over the
  // sidebar cannot chain into the body (white band under the shell).
  return (
    <div className="fixed inset-0 flex overflow-hidden overscroll-none bg-shop-floor">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-none">
        {children}
      </div>
    </div>
  )
}
