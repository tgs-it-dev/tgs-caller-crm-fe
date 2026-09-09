import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { PhoneIcon } from '@/components/icons/PhoneIcon'
import { LiveCallStatus } from '@/components/workspace/LiveCallStatus'
import { formatDate, formatPhone } from '@/lib/format'
import type { InteractionDetail } from '@/lib/interactions'
import { SOURCE_LABEL } from '@/lib/leadSource'

export function QueueRow({ interaction }: { interaction: InteractionDetail }) {
  return (
    <Link
      href={`/fronter/workspace/${interaction.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-slate/20 bg-white px-4 py-3.5 transition hover:border-navy/40 hover:bg-slate/5"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate/10 text-navy">
          <PhoneIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {formatPhone(interaction.lead.phone_normalized)}
          </p>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-y-1 text-xs text-slate">
            <Badge tone="neutral">{SOURCE_LABEL[interaction.lead.source]}</Badge>
            <span className="ml-2">Lead since {formatDate(interaction.lead.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-4">
        <div className="w-28">
          <LiveCallStatus status={interaction.status} startedAt={interaction.started_at} />
        </div>
        <span className="hidden text-sm font-medium text-navy sm:inline">Open →</span>
      </div>
    </Link>
  )
}
