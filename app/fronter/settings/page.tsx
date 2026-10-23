import { RequireRole } from '@/components/auth/RequireRole'
import { SettingsScreen } from '@/components/settings/SettingsScreen'

export default function FronterSettingsPage() {
  return (
    <RequireRole role="fronter">
      <SettingsScreen />
    </RequireRole>
  )
}
