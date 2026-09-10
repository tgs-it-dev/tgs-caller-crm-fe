import { RequireAuth } from '@/components/auth/RequireRole'

export default function DashboardPage() {
  return (
    <RequireAuth>
      <div className="p-8">
        <h2 className="text-xl font-semibold">Dashboard (mock)</h2>
        <p className="text-sm text-gray-600">Live dashboard and historical funnel (mock data).</p>
      </div>
    </RequireAuth>
  )
}
