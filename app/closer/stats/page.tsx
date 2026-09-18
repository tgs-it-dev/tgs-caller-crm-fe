import { RequireRole } from '@/components/auth/RequireRole'
import { PageShell } from '@/components/ui/PageShell'

export default function CloserStatsPage() {
  return (
    <RequireRole role="closer">
      <PageShell title="My Stats">
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Closer stats will land here in a later ticket.
        </p>
      </PageShell>
    </RequireRole>
  )
}
