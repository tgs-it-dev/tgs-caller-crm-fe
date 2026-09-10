import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Textarea } from '@/components/ui/Textarea'
import type { InteractionDetail } from '@/lib/interactions'
import {
  ConsentDnc,
  QualificationSnapshot,
  canTransfer,
  transferRequirements,
} from '@/lib/qualification'
import { LiveCallStatus } from './LiveCallStatus'

function CheckIcon({ met }: { met: boolean }) {
  if (met) {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0 text-teal-400" aria-hidden>
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  return <span className="h-4 w-4 flex-shrink-0 rounded-full border border-white/20" aria-hidden />
}

export function ActionRail({
  interaction,
  snapshot,
  consent,
  version,
  isSaving,
  isTransferring,
  saveError,
  transferError,
  transferStatus,
  onOverrideChange,
  onSave,
  onTransfer,
}: {
  interaction: InteractionDetail
  snapshot: QualificationSnapshot
  consent: ConsentDnc
  version: number | null
  isSaving: boolean
  isTransferring: boolean
  saveError: string | null
  transferError: string | null
  transferStatus: string | null
  onOverrideChange: (patch: Partial<QualificationSnapshot['override']>) => void
  onSave: () => void
  onTransfer: () => void
}) {
  const eligible = canTransfer(snapshot, consent)
  const requirements = transferRequirements(snapshot, consent)
  const unmet = requirements.filter((r) => !r.met)
  const overridableUnmet = unmet.some((r) => r.overridable)

  return (
    <div className="sticky top-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <LiveCallStatus status={interaction.status} startedAt={interaction.started_at} />

      <div className="my-5 h-px bg-white/10" />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Transfer readiness</h2>
        {version !== null && (
          <span className="text-xs text-neutral-500">Qualification saved · v{version}</span>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {requirements.map((req) => (
          <li key={req.key} className="flex items-start gap-2 text-sm">
            <CheckIcon met={req.met} />
            <span className={req.met ? 'text-neutral-300' : 'text-neutral-400'}>{req.label}</span>
          </li>
        ))}
      </ul>

      {overridableUnmet && !consent.dnc_flagged && snapshot.disposition === 'qualified' && (
        <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3.5">
          <Checkbox
            label="Apply BE-B-06 override — transfer with an incomplete checklist"
            checked={snapshot.override.applied}
            onChange={(e) => onOverrideChange({ applied: e.target.checked })}
          />
          {snapshot.override.applied && (
            <div className="mt-3">
              <Textarea
                aria-label="Override reason"
                value={snapshot.override.reason}
                onChange={(e) => onOverrideChange({ reason: e.target.value })}
                rows={2}
                placeholder="Reason for overriding (required, logged for audit)"
                className="text-xs"
              />
            </div>
          )}
        </div>
      )}

      <div className="my-5 h-px bg-white/10" />

      {saveError && <Alert>{saveError}</Alert>}
      {transferError && <Alert>{transferError}</Alert>}

      {transferStatus ? (
        <p className="rounded-lg border border-teal-400/30 bg-teal-500/10 px-3.5 py-3 text-sm text-teal-300">
          Transfer sent — status: <span className="font-medium">{transferStatus}</span>. Waiting
          for a closer to accept.
        </p>
      ) : (
        <div className="space-y-2.5">
          <Button
            type="button"
            onClick={onTransfer}
            disabled={!eligible}
            isLoading={isTransferring}
            loadingText="Transferring…"
            className="py-3 text-base"
          >
            Transfer to closer
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onSave}
            isLoading={isSaving}
            loadingText="Saving…"
          >
            Save qualification
          </Button>
        </div>
      )}
    </div>
  )
}
