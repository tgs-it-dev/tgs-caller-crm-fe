import { RequireRole } from '@/components/auth/RequireRole'
import { PageShell } from '@/components/ui/PageShell'

export default function AdminReportsPage() {
  return (
    <RequireRole role="administrator">
      <PageShell title="Reports">
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Reports will land here in a later ticket.
        </p>
      </PageShell>
    </RequireRole>
  )
}
