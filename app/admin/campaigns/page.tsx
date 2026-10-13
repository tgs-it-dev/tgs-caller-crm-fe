import { RequireRole } from '@/components/auth/RequireRole'
import { PageShell } from '@/components/ui/PageShell'

export default function AdminCampaignsPage() {
  return (
    <RequireRole role="super_admin">
      <PageShell title="Campaigns">
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Campaigns management is coming next — list, create, and assign teams here.
        </p>
      </PageShell>
    </RequireRole>
  )
}
