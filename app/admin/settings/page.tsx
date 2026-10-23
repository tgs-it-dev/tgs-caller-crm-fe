import { RequireRole } from '@/components/auth/RequireRole'
import { SettingsScreen } from '@/components/settings/SettingsScreen'

export default function AdminSettingsPage() {
  return (
    <RequireRole role="administrator">
      <SettingsScreen />
    </RequireRole>
  )
}
