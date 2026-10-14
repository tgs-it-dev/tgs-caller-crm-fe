import { CampaignsScreen } from '@/components/admin/CampaignsScreen'
import { RequireRole } from '@/components/auth/RequireRole'

export default function AdminCampaignsPage() {
  return (
    <RequireRole role="super_admin">
      <CampaignsScreen />
    </RequireRole>
  )
}
