import { RequireRole } from '@/components/auth/RequireRole'

export default function CloserPage() {
  return (
    <RequireRole role="closer">
      <div className="p-8">
        <h2 className="text-xl font-semibold">Closer Workspace (mock)</h2>
        <p className="text-sm text-gray-600">Mock screen-pop and interaction controls.</p>
      </div>
    </RequireRole>
  )
}
