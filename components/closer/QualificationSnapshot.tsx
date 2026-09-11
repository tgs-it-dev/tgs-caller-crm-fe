import type { CloserQualificationSnapshot } from '@/lib/closer'

const ROWS: { label: string; key: keyof CloserQualificationSnapshot }[] = [
  { label: 'Vehicle Year / Make / Model :', key: 'vehicle' },
  { label: 'Mileage:', key: 'mileage' },
  { label: 'State:', key: 'state' },
  { label: 'Warranty Status:', key: 'warranty_status' },
  { label: 'Consent / DNC confirmation:', key: 'consent_label' },
  { label: 'Notes:', key: 'notes' },
]

export function QualificationSnapshot({ snapshot }: { snapshot: CloserQualificationSnapshot }) {
  return (
    // Same dashed live-card border as Queue "Waiting / Ringing".
    <div className="h-full rounded-xl border-2 border-dashed border-relay-blue bg-white p-5">
      <h2 className="border-b-hairline border-slate pb-4 text-lg font-medium leading-[120%] text-ink">
        Qualification Snapshot
      </h2>
      <dl className="mt-4 space-y-2">
        {ROWS.map(({ label, key }) => (
          <div
            key={key}
            className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-8"
          >
            <dt className="text-sm leading-[150%] text-slate">{label}</dt>
            <dd className="text-[16px] font-medium leading-[150%] text-ink">{snapshot[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
