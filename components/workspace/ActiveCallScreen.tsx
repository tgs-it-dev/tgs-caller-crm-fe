'use client'

import { useEffect, useState } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { PageShell } from '@/components/ui/PageShell'
import { CallerLeadInfo } from './CallerLeadInfo'
import { DispositionCard } from './DispositionCard'
import { QualificationChecklist } from './QualificationChecklist'
import { TransferPanel } from './TransferPanel'
import {
  captureDisposition,
  latestFronterDisposition,
  type DispositionResponse,
} from '@/lib/dispositions'
import { formatElapsed } from '@/lib/format'
import { loadActiveCallWorkspace } from '@/lib/activeCall'
import {
  InteractionNotFoundError,
  type InteractionDetail,
} from '@/lib/interactions'
import { waitForMocking } from '@/lib/mockReady'
import {
  DNC_LABEL,
  EMPTY_ACTIVE_CALL_FORM,
  activeCallFormFromQualification,
  canEndActiveCall,
  canTransferActiveCall,
  consentFromActiveCall,
  dispositionAllowsTransfer,
  hasCapturedSomething,
  missingActiveCallTransferFields,
  needsActiveCallOverride,
  snapshotJsonFromActiveCall,
  submitQualification,
  type ActiveCallForm,
} from '@/lib/qualification'
import { AuthError } from '@/lib/auth'
import { leaveFronterQueue } from '@/lib/queue'
import { withSession } from '@/lib/session'
import { createTransfer, type AvailableCloserItem } from '@/lib/transfers'

function LiveCallBadge({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startedAt))

  useEffect(() => {
    const id = setInterval(() => setElapsed(formatElapsed(startedAt)), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <div className="flex items-center gap-3">
      <Badge tone="live" dot>
        Live
      </Badge>
      <span className="text-sm text-ink">on call — {elapsed}</span>
    </div>
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      interaction: InteractionDetail
      dispositions: DispositionResponse[]
      closers: AvailableCloserItem[]
    }

export function ActiveCallScreen({ interactionId }: { interactionId: string }) {
  return (
    <RequireRole role="fronter">
      <ActiveCallBody key={interactionId} interactionId={interactionId} />
    </RequireRole>
  )
}

function ActiveCallBody({ interactionId }: { interactionId: string }) {
  const { user } = useCurrentUser()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [form, setForm] = useState<ActiveCallForm>(EMPTY_ACTIVE_CALL_FORM)
  const [dispositionId, setDispositionId] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  /** The outcome this call was closed with, once Save & End Call has run. */
  const [ended, setEnded] = useState<string | null>(null)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferStatus, setTransferStatus] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => loadActiveCallWorkspace(interactionId, token)))
      .then(({ interaction, qualification, dispositions, capturedDispositions, closers }) => {
        if (cancelled) return

        if (qualification) {
          setForm(
            activeCallFormFromQualification(
              qualification.snapshot_json as unknown as Record<string, unknown>,
              qualification.consent_dnc
            )
          )
        } else if (interaction.qualification) {
          setForm(
            activeCallFormFromQualification(null, interaction.qualification.consent_dnc)
          )
        }

        const latest = latestFronterDisposition(capturedDispositions)
        if (latest) setDispositionId(latest.disposition_id)

        setLoad({ status: 'ready', interaction, dispositions, closers })
      })
      .catch((err) => {
        if (cancelled) return
        const message =
          err instanceof InteractionNotFoundError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Something went wrong loading this call. Please try again.'
        setLoad({ status: 'error', message })
      })

    return () => {
      cancelled = true
    }
  }, [interactionId])

  function patchForm(patch: Partial<ActiveCallForm>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  /** The qualification and the disposition, in the order the API expects. */
  async function recordOutcome(dispositionId: string) {
    // Only when the fronter captured something: a blank form would otherwise
    // assert consent was taken on a call nobody answered.
    if (hasCapturedSomething(form)) {
      await withSession((token) =>
        submitQualification(
          {
            interaction_id: interactionId,
            snapshot_json: snapshotJsonFromActiveCall(form),
            consent_dnc: consentFromActiveCall(form),
          },
          token
        )
      )
    }
    await withSession((token) =>
      captureDisposition(interactionId, { disposition_id: dispositionId }, token)
    )
  }

  async function handleEndCall() {
    if (!disposition) return

    setIsEnding(true)
    setTransferError(null)
    try {
      await recordOutcome(disposition.id)
      // Tolerates a 404: an interaction opened by direct link may have no open
      // row, and the outcome is saved by this point either way.
      await withSession((token) => leaveFronterQueue(interactionId, token))
      setEnded(disposition.label)
    } catch (err) {
      setTransferError(
        err instanceof Error ? err.message : 'Unable to save this call. Please try again.'
      )
    } finally {
      setIsEnding(false)
    }
  }

  async function handleTransfer() {
    if (!user) {
      setTransferError('Unable to identify the current agent. Please refresh and try again.')
      return
    }
    if (form.dnc_flagged) {
      setTransferError('This lead is flagged Do Not Call. Transfer is blocked.')
      return
    }

    if (!disposition) return

    setIsTransferring(true)
    setTransferError(null)
    try {
      // The same two writes as ending the call. The server reads the
      // disposition to decide whether a handoff is allowed, so it lands first.
      await recordOutcome(disposition.id)

      const missing = missingActiveCallTransferFields(form)
      const reason = overrideReason.trim()
      const transfer = await withSession((token) =>
        createTransfer(
          {
            interaction_id: interactionId,
            fronter_user_id: user.id,
            ...(missing.length > 0 && reason ? { override_reason: reason } : {}),
          },
          token
        )
      )
  
      setTransferStatus(transfer.status)
    } catch (err) {
      if (err instanceof AuthError && err.code === 'transfer.no_closer_available') {
        setTransferError(
          'No closers available right now. Try again when someone is free, or end the call.'
        )
      } else if (err instanceof AuthError && err.code === 'transfer.disposition_not_transferable') {
        setTransferError(err.message)
      } else {
        setTransferError(err instanceof Error ? err.message : 'Unable to transfer. Please try again.')
      }
    } finally {
      setIsTransferring(false)
    }
  }

  if (load.status === 'loading') {
    return (
      <PageShell title="Active Call">
        <p className="rounded-xl border-hairline border-slate bg-white px-4 py-10 text-center text-sm text-slate">
          Loading call…
        </p>
      </PageShell>
    )
  }

  if (load.status === 'error') {
    return (
      <PageShell title="Active Call">
        <Alert>{load.message}</Alert>
      </PageShell>
    )
  }

  const disposition = load.dispositions.find((row) => row.id === dispositionId) ?? null
  // Not cleared when the fronter moves off it: un-ticking a suppression they
  // just asserted is the one direction that loses something.
  const dncByDisposition = disposition?.label === DNC_LABEL
  const eligible = canTransferActiveCall(form, { disposition, overrideReason })
  const needsOverride = needsActiveCallOverride(form)

  return (
    <PageShell
      title="Active Call"
      actions={<LiveCallBadge startedAt={load.interaction.started_at} />}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <CallerLeadInfo interaction={load.interaction} />
          <QualificationChecklist
            form={form}
            onChange={patchForm}
            dncLockedByDisposition={dncByDisposition}
          />
        </div>
        <div className="space-y-4">
          <DispositionCard
            options={load.dispositions}
            dispositionId={dispositionId}
            onDispositionChange={(id) => {
              setDispositionId(id)
              // Set here rather than in an effect: a synchronous setState in an
              // effect is the lint error this repo already trips, and the change
              // handler is where the two facts meet anyway.
              const picked = load.dispositions.find((row) => row.id === id)
              if (picked?.label === DNC_LABEL) {
                patchForm({ dnc_flagged: true, dnc_source: 'fronter_active_call' })
              }
            }}
          />
          <TransferPanel
            closers={load.closers}
            canTransfer={eligible}
            needsOverride={needsOverride}
            dncFlagged={form.dnc_flagged}
            overrideReason={overrideReason}
            onOverrideReasonChange={setOverrideReason}
            isTransferring={isTransferring}
            transferError={transferError}
            transferStatus={transferStatus}
            onTransfer={handleTransfer}
            canEnd={canEndActiveCall({ disposition })}
            isEnding={isEnding}
            endedAs={ended}
            onEndCall={handleEndCall}
            dispositionLabel={disposition?.label ?? null}
            dispositionAllowsTransfer={dispositionAllowsTransfer(disposition)}
          />
        </div>
      </div>
    </PageShell>
  )
}
