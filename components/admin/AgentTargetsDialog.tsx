'use client'

import { useId, useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { saveAgentTargets, type AgentStats, type AgentTargets } from '@/lib/agentStats'
import { AuthError } from '@/lib/auth'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

const PERIODS = [
  { key: 'daily', label: 'per day' },
  { key: 'weekly', label: 'per week' },
  { key: 'monthly', label: 'per month' },
] as const

type Key = (typeof PERIODS)[number]['key']

const MAX_TARGET = 100_000

function draftOf(targets: AgentTargets): Record<Key, string> {
  const text = (value: number | null) => (value === null ? '' : String(value))
  return {
    daily: text(targets.daily),
    weekly: text(targets.weekly),
    monthly: text(targets.monthly),
  }
}

/** A whole number from 1 up, or blank for no target. */
function problemWith(value: string): string | null {
  if (value.trim() === '') return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1)
    return 'Enter a whole number from 1 up, or leave it blank.'
  if (number > MAX_TARGET) return `Enter ${MAX_TARGET.toLocaleString()} or less.`
  return null
}

function messageFor(err: unknown): string {
  if (err instanceof AuthError && err.status === 404) return 'This agent is not on your team.'
  if (err instanceof AuthError && err.status === 401)
    return 'Your session has ended. Please sign in again.'
  if (err instanceof AuthError) return err.message
  return 'Something went wrong. Please try again.'
}

/**
 * An agent's daily, weekly and monthly targets: qualifications for a fronter,
 * sales for a closer. A blank one is no target.
 */
export function AgentTargetsDialog({
  agent,
  onClose,
  onSaved,
}: {
  agent: AgentStats
  onClose: () => void
  onSaved: (targets: AgentTargets) => void
}) {
  const formId = useId()
  const [draft, setDraft] = useState(() => draftOf(agent.targets))
  const [problems, setProblems] = useState<Partial<Record<Key, string>>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const measured = agent.stage === 'fronter' ? 'Qualifications' : 'Sales'

  async function save(event: FormEvent) {
    event.preventDefault()
    const found: Partial<Record<Key, string>> = {}
    for (const { key } of PERIODS) {
      const problem = problemWith(draft[key])
      if (problem) found[key] = problem
    }
    setProblems(found)
    setBanner(null)
    if (Object.keys(found).length > 0) return

    const value = (key: Key) => (draft[key].trim() === '' ? null : Number(draft[key]))
    setBusy(true)
    try {
      await waitForMocking()
      const saved = await withSession((token) =>
        saveAgentTargets(
          agent.user_id,
          agent.stage,
          { daily: value('daily'), weekly: value('weekly'), monthly: value('monthly') },
          token
        )
      )
      onSaved(saved)
    } catch (err) {
      setBanner(messageFor(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      title={`Targets for ${agent.name}`}
      onClose={onClose}
      busy={busy}
      maxWidth="sm"
      actions={
        <div className="flex w-full gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={busy} loadingText="Saving…">
            Save targets
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          void save(event)
        }}
        noValidate
        className="space-y-4 pt-1"
      >
        <p className="text-sm leading-[150%] text-body-text">
          {agent.stage === 'fronter'
            ? 'How many qualifications this fronter should reach. Leave one blank for no target.'
            : 'How many sales this closer should make. Leave one blank for no target.'}
        </p>
        {banner && <Alert>{banner}</Alert>}
        {PERIODS.map(({ key, label }) => (
          <Input
            key={key}
            label={`${measured} ${label}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_TARGET}
            value={draft[key]}
            onChange={(e) => setDraft((current) => ({ ...current, [key]: e.target.value }))}
            error={Boolean(problems[key])}
            helperText={problems[key]}
          />
        ))}
      </form>
    </Dialog>
  )
}
