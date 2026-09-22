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
  EMPTY_ACTIVE_CALL_FORM,
  activeCallFormFromQualification,
  canTransferActiveCall,
  consentFromActiveCall,
  missingActiveCallTransferFields,
  snapshotJsonFromActiveCall,
  submitQualification,
  type ActiveCallForm,
} from '@/lib/qualification'
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

  async function handleTransfer() {
    if (!user) {
      setTransferError('Unable to identify the current agent. Please refresh and try again.')
      return
    }

    setIsTransferring(true)
    setTransferError(null)
    try {
      const transfer = await withSession(async (token) => {
        await submitQualification(
          {
            interaction_id: interactionId,
            snapshot_json: snapshotJsonFromActiveCall(form),
            consent_dnc: consentFromActiveCall(form),
          },
          token
        )

        if (dispositionId) {
          await captureDisposition(interactionId, { disposition_id: dispositionId }, token)
        }

        const missing = missingActiveCallTransferFields(form)
        const reason = overrideReason.trim()
        return createTransfer(
          {
            interaction_id: interactionId,
            fronter_user_id: user.id,
            ...(missing.length > 0 && reason ? { override_reason: reason } : {}),
          },
          token
        )
      })
      setTransferStatus(transfer.status)
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Unable to transfer. Please try again.')
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

  const eligible = canTransferActiveCall(form, { dispositionId, overrideReason })
  const needsOverride = missingActiveCallTransferFields(form).length > 0

  return (
    <PageShell
      title="Active Call"
      actions={<LiveCallBadge startedAt={load.interaction.started_at} />}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <CallerLeadInfo interaction={load.interaction} />
          <QualificationChecklist form={form} onChange={patchForm} />
        </div>
        <div className="space-y-4">
          <DispositionCard
            options={load.dispositions}
            dispositionId={dispositionId}
            onDispositionChange={setDispositionId}
          />
          <TransferPanel
            closers={load.closers}
            canTransfer={eligible}
            needsOverride={needsOverride}
            overrideReason={overrideReason}
            onOverrideReasonChange={setOverrideReason}
            isTransferring={isTransferring}
            transferError={transferError}
            transferStatus={transferStatus}
            onTransfer={handleTransfer}
          />
        </div>
      </div>
    </PageShell>
  )
}
