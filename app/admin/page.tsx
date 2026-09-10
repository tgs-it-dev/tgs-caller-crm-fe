import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminPage() {
  return (
    <RequireRole role="administrator">
      <div className="p-8">
        <h2 className="text-xl font-semibold">Admin Console (mock)</h2>
        <p className="text-sm text-gray-600">Role management and dispositions (mocked).</p>
      </div>
    </RequireRole>
  )
}
