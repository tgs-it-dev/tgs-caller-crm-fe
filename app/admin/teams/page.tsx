import { RequireRole } from '@/components/auth/RequireRole'
import { PageShell } from '@/components/ui/PageShell'

export default function AdminTeamsPage() {
  return (
    <RequireRole role="super_admin">
      <PageShell title="Teams">
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Teams management is coming next — create, rename, and deactivate teams here.
        </p>
      </PageShell>
    </RequireRole>
  )
}
