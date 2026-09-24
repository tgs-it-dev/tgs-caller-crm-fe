import { ExceptionsScreen } from '@/components/admin/ExceptionsScreen'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminExceptionsPage() {
  return (
    <RequireRole role="administrator">
      <ExceptionsScreen />
    </RequireRole>
  )
}
