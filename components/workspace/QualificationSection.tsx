import { Checkbox } from '@/components/ui/Checkbox'
import { Textarea } from '@/components/ui/Textarea'
import {
  CHECKLIST_ITEMS,
  ChecklistKey,
  ConsentDnc,
  DISPOSITIONS,
  Disposition,
  QualificationSnapshot,
} from '@/lib/qualification'

function DispositionPicker({
  value,
  onChange,
}: {
  value: Disposition | null
  onChange: (value: Disposition) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DISPOSITIONS.map((d) => {
        const active = value === d.value
        return (
          <button
            key={d.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(d.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              active
                ? 'border-teal-400/60 bg-teal-500/15 text-teal-200'
                : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/20 hover:bg-white/[0.06]'
            }`}
          >
            {d.label}
          </button>
        )
      })}
    </div>
  )
}

export function QualificationSection({
  snapshot,
  consent,
  onChecklistChange,
  onDispositionChange,
  onNotesChange,
  onConsentChange,
}: {
  snapshot: QualificationSnapshot
  consent: ConsentDnc
  onChecklistChange: (key: ChecklistKey, value: boolean) => void
  onDispositionChange: (value: Disposition) => void
  onNotesChange: (notes: string) => void
  onConsentChange: (patch: Partial<ConsentDnc>) => void
}) {
  const completedCount = CHECKLIST_ITEMS.filter((item) => snapshot.checklist[item.key]).length

  return (
    <div className="space-y-8 py-6">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">Qualification checklist</h2>
          <span className="text-xs text-neutral-500">
            {completedCount} of {CHECKLIST_ITEMS.length} complete
          </span>
        </div>
        <div className="mb-4 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${(completedCount / CHECKLIST_ITEMS.length) * 100}%` }}
          />
        </div>
        <div className="space-y-2.5">
          {CHECKLIST_ITEMS.map((item) => (
            <Checkbox
              key={item.key}
              label={item.label}
              checked={snapshot.checklist[item.key]}
              onChange={(e) => onChecklistChange(item.key, e.target.checked)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-white">Consent &amp; compliance</h2>
        <div className="space-y-2.5">
          <Checkbox
            label="Customer consented to be contacted about this offer"
            checked={consent.consent_given}
            onChange={(e) =>
              onConsentChange({
                consent_given: e.target.checked,
                consent_captured_at: e.target.checked ? new Date().toISOString() : null,
              })
            }
          />
          <Checkbox
            label="Flag as Do Not Call"
            checked={consent.dnc_flagged}
            onChange={(e) =>
              onConsentChange({
                dnc_flagged: e.target.checked,
                dnc_source: e.target.checked ? 'fronter_workspace' : null,
              })
            }
          />
        </div>
        {consent.dnc_flagged && (
          <p className="mt-2.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            This lead is flagged Do Not Call. Transfer is blocked and cannot be overridden.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-white">Disposition</h2>
        <DispositionPicker value={snapshot.disposition} onChange={onDispositionChange} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-white">Notes</h2>
        <Textarea
          aria-label="Call notes"
          value={snapshot.notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={4}
          placeholder="Anything relevant for the closer — objections, timeline, context…"
        />
      </section>
    </div>
  )
}
