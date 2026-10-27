import { RequireRole } from '@/components/auth/RequireRole'
import { PageShell } from '@/components/ui/PageShell'

export default function QaHomePage() {
  return (
    <RequireRole role="qa_agent" exact>
      <PageShell title="QA">
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          QA workspace is not available yet.
        </p>
      </PageShell>
    </RequireRole>
  )
}
