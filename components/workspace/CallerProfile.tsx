import { PhoneIcon } from '@/components/icons/PhoneIcon'
import { formatDate, formatPhone } from '@/lib/format'
import type { InteractionDetail } from '@/lib/interactions'
import { SOURCE_LABEL } from '@/lib/leadSource'

export function CallerProfile({ interaction }: { interaction: InteractionDetail }) {
  return (
    <div className="flex items-start gap-4 border-b border-white/10 pb-6">
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-teal-300">
        <PhoneIcon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {formatPhone(interaction.lead.phone_normalized)}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-400">
          <span>Source: {SOURCE_LABEL[interaction.lead.source]}</span>
          <span className="text-neutral-600">·</span>
          <span>Lead since {formatDate(interaction.lead.created_at)}</span>
          <span className="text-neutral-600">·</span>
          <span className="font-mono text-xs text-neutral-500">{interaction.id}</span>
        </div>
      </div>
    </div>
  )
}
