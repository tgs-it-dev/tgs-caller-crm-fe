import { formatDate, formatPhone } from '@/lib/format'
import type { InteractionDetail } from '@/lib/interactions'

const SOURCE_LABEL: Record<InteractionDetail['lead']['source'], string> = {
  vicidial: 'VICIdial',
  ghl: 'GoHighLevel',
}

export function CallerProfile({ interaction }: { interaction: InteractionDetail }) {
  return (
    <div className="flex items-start gap-4 border-b border-white/10 pb-6">
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-teal-300">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
          <path
            d="M6.62 10.79a15.09 15.09 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z"
            fill="currentColor"
          />
        </svg>
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
