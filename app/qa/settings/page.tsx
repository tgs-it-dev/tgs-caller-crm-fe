import { RequireRole } from '@/components/auth/RequireRole'
import { SettingsScreen } from '@/components/settings/SettingsScreen'

export default function QaSettingsPage() {
  return (
    <RequireRole role="qa_agent" exact>
      <SettingsScreen />
    </RequireRole>
  )
}
