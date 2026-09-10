import { RequireRole } from '@/components/auth/RequireRole'
import { PageShell } from '@/components/ui/PageShell'

export default function FronterStatsPage() {
  return (
    <RequireRole role="fronter">
      <PageShell title="My Stats">
        <p className="text-sm text-slate">Coming soon.</p>
      </PageShell>
    </RequireRole>
  )
}
