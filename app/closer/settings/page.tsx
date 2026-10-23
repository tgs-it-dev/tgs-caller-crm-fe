import { RequireRole } from '@/components/auth/RequireRole'
import { SettingsScreen } from '@/components/settings/SettingsScreen'

export default function CloserSettingsPage() {
  return (
    <RequireRole role="closer">
      <SettingsScreen />
    </RequireRole>
  )
}
