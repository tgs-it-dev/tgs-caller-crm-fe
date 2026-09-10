import { CurrentUserProvider } from '@/components/auth/CurrentUserProvider'
import { Sidebar } from '@/components/dashboard/Sidebar'

export default function FronterLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrentUserProvider>
      <div className="flex h-screen bg-shop-floor">
        <Sidebar />
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </CurrentUserProvider>
  )
}
