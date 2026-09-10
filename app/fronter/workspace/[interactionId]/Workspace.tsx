'use client'

import { useCallback, useEffect, useState } from 'react'
import { RequireRole } from '@/components/auth/RequireRole'
import { Alert } from '@/components/ui/Alert'
import { ActionRail } from '@/components/workspace/ActionRail'
import { CallerProfile } from '@/components/workspace/CallerProfile'
import { QualificationSection } from '@/components/workspace/QualificationSection'
import { getCurrentUser, readToken } from '@/lib/auth'
import { InteractionDetail, InteractionNotFoundError, getInteraction } from '@/lib/interactions'
import { waitForMocking } from '@/lib/mockReady'
import {
  ChecklistKey,
  ConsentDnc,
  Disposition,
  EMPTY_CHECKLIST,
  QualificationSnapshot,
  getLatestQualification,
  submitQualification,
} from '@/lib/qualification'
import { createTransfer } from '@/lib/transfers'

const EMPTY_CONSENT: ConsentDnc = {
  consent_given: false,
  consent_captured_at: null,
  dnc_flagged: false,
  dnc_source: null,
}

const EMPTY_SNAPSHOT: QualificationSnapshot = {
  checklist: EMPTY_CHECKLIST,
  disposition: null,
  notes: '',
  override: { applied: false, reason: '' },
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; interaction: InteractionDetail }

export function Workspace({ interactionId }: { interactionId: string }) {
  return (
    <RequireRole role="fronter">
      <WorkspaceContent interactionId={interactionId} />
    </RequireRole>
  )
}

function WorkspaceContent({ interactionId }: { interactionId: string }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [snapshot, setSnapshot] = useState<QualificationSnapshot>(EMPTY_SNAPSHOT)
  const [consent, setConsent] = useState<ConsentDnc>(EMPTY_CONSENT)
  const [version, setVersion] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferStatus, setTransferStatus] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const token = readToken()
    if (!token) return

    async function load() {
      try {
        await waitForMocking()
        const [interaction, qualification] = await Promise.all([
          getInteraction(interactionId, token!),
          getLatestQualification(interactionId, token!),
        ])
        if (cancelled) return

        if (qualification) {
          setSnapshot(qualification.snapshot_json)
          setConsent(qualification.consent_dnc)
          setVersion(qualification.version)
        }
        setLoad({ status: 'ready', interaction })
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof InteractionNotFoundError
            ? err.message
            : 'Something went wrong loading this call. Please try again.'
        setLoad({ status: 'error', message })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [interactionId])

  const handleChecklistChange = useCallback((key: ChecklistKey, value: boolean) => {
    setSnapshot((prev) => ({ ...prev, checklist: { ...prev.checklist, [key]: value } }))
  }, [])

  const handleDispositionChange = useCallback((value: Disposition) => {
    setSnapshot((prev) => ({ ...prev, disposition: value }))
  }, [])

  const handleNotesChange = useCallback((notes: string) => {
    setSnapshot((prev) => ({ ...prev, notes }))
  }, [])

  const handleConsentChange = useCallback((patch: Partial<ConsentDnc>) => {
    setConsent((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleOverrideChange = useCallback((patch: Partial<QualificationSnapshot['override']>) => {
    setSnapshot((prev) => ({ ...prev, override: { ...prev.override, ...patch } }))
  }, [])

  async function handleSave() {
    const token = readToken()
    if (!token) return

    setIsSaving(true)
    setSaveError(null)
    try {
      const result = await submitQualification(
        { interaction_id: interactionId, snapshot_json: snapshot, consent_dnc: consent },
        token
      )
      setVersion(result.version)
      setConsent(result.consent_dnc)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTransfer() {
    const token = readToken()
    if (!token) return

    setIsTransferring(true)
    setTransferError(null)
    try {
      const savedQualification = await submitQualification(
        { interaction_id: interactionId, snapshot_json: snapshot, consent_dnc: consent },
        token
      )
      setVersion(savedQualification.version)

      const user = await getCurrentUser(token)
      const transfer = await createTransfer(
        { interaction_id: interactionId, fronter_user_id: user.id },
        token
      )
      setTransferStatus(transfer.status)
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Unable to transfer. Please try again.')
    } finally {
      setIsTransferring(false)
    }
  }

  if (load.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="text-sm text-neutral-400">Loading call…</p>
      </div>
    )
  }

  if (load.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
        <div className="w-full max-w-sm">
          <Alert>{load.message}</Alert>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <CallerProfile interaction={load.interaction} />
          <QualificationSection
            snapshot={snapshot}
            consent={consent}
            onChecklistChange={handleChecklistChange}
            onDispositionChange={handleDispositionChange}
            onNotesChange={handleNotesChange}
            onConsentChange={handleConsentChange}
          />
        </div>

        <div>
          <ActionRail
            interaction={load.interaction}
            snapshot={snapshot}
            consent={consent}
            version={version}
            isSaving={isSaving}
            isTransferring={isTransferring}
            saveError={saveError}
            transferError={transferError}
            transferStatus={transferStatus}
            onOverrideChange={handleOverrideChange}
            onSave={handleSave}
            onTransfer={handleTransfer}
          />
        </div>
      </div>
    </main>
  )
}
