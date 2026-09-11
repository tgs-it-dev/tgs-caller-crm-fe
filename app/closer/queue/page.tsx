import { RequireRole } from '@/components/auth/RequireRole'
import { PageShell } from '@/components/ui/PageShell'

export default function CloserQueuePage() {
  return (
    <RequireRole role="closer">
      <PageShell title="Queue">
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Closer queue will land here once the inbound-offer list contract ships.
        </p>
      </PageShell>
    </RequireRole>
  )
}
