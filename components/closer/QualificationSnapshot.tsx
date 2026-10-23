import type { ReactNode } from 'react'
import type { CloserQualificationSnapshot } from '@/lib/closer'
import { formatPhone } from '@/lib/format'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="border-b-hairline border-light-grey pb-2 text-base font-semibold leading-[120%] text-ink">
        {title}
      </h3>
      <dl className="space-y-2">{children}</dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const text = value.trim()
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-8">
      <dt className="text-sm font-normal leading-[150%] text-body-text">{label}</dt>
      <dd className="text-base font-medium leading-[150%] text-ink">{text || '—'}</dd>
    </div>
  )
}

export function QualificationSnapshot({
  snapshot,
  isLoading = false,
}: {
  snapshot: CloserQualificationSnapshot | null
  isLoading?: boolean
}) {
  return (
    // Same dashed live-card border as Queue "Waiting / Ringing".
    <div className="h-full rounded-xl border-2 border-dashed border-relay-blue bg-white p-5">
      <h2 className="border-b-hairline border-light-grey pb-4 text-lg font-medium leading-[120%] text-ink">
        Qualification Snapshot
      </h2>
      {snapshot ? (
        <div className="mt-4 space-y-6">
          <Section title="Personal">
            <Row label="First name:" value={snapshot.first_name} />
            <Row label="Last name:" value={snapshot.last_name} />
            <Row
              label="Phone:"
              value={snapshot.phone_no ? formatPhone(snapshot.phone_no) : ''}
            />
          </Section>

          <Section title="Vehicle">
            <Row label="Make:" value={snapshot.vehicle_make} />
            <Row label="Model:" value={snapshot.vehicle_model} />
            <Row label="Year:" value={snapshot.vehicle_year} />
          </Section>

          <Section title="Identity">
            <Row label="VIN:" value={snapshot.vin} />
            <Row label="License plate:" value={snapshot.license_plate} />
          </Section>
        </div>
      ) : (
        !isLoading && (
          <p className="mt-4 text-sm leading-[150%] text-slate">
            No qualification snapshot found for this interaction.
          </p>
        )
      )}
    </div>
  )
}
