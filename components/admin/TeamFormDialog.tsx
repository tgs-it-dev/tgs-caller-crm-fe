'use client'

import { useId, useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { AuthError } from '@/lib/auth'
import { withSession } from '@/lib/session'
import {
  createTeam,
  isDefaultTeam,
  updateTeam,
  type Team,
  type TeamPatch,
} from '@/lib/teams'

/** Copy for the codes whose own wording is written for an API, not a person. */
const FIELD_COPY: Record<string, string> = {
  'team.already_exists': 'That team name is already in use.',
}

function bannerFor(err: AuthError): string {
  if (err.code === 'team.not_found') return 'That team no longer exists.'
  if (err.code === 'team.default_locked') {
    return 'Default Team cannot be renamed or deactivated.'
  }
  if (err.status === 403) return 'You no longer have access to team administration.'
  if (err.status === 401) return 'Your session has ended. Please sign in again.'
  return err.message
}

export function TeamFormDialog({
  team,
  onClose,
  onSaved,
}: {
  /** The team being edited, or null to add one. */
  team: Team | null
  onClose: () => void
  onSaved: () => void
}) {
  const formId = useId()
  const locked = Boolean(team && isDefaultTeam(team))
  const [name, setName] = useState(team?.name ?? '')
  const [active, setActive] = useState(team?.active ?? true)
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function checkHere(): Record<string, string> {
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Enter a name.'
    return found
  }

  function showFailure(err: unknown) {
    if (!(err instanceof AuthError)) {
      setBanner('Something went wrong. Please try again.')
      return
    }
    const named = err.fields.filter((field) => field.field)
    if (named.length > 0) {
      setProblems(
        Object.fromEntries(
          named.map((field) => [field.field as string, FIELD_COPY[err.code] ?? field.message])
        )
      )
      return
    }
    setBanner(bannerFor(err))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked) return
    const found = checkHere()
    setProblems(found)
    setBanner(null)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      if (team) {
        const patch: TeamPatch = {}
        if (name.trim() !== team.name) patch.name = name.trim()
        if (active !== team.active) patch.active = active
        if (Object.keys(patch).length > 0) {
          await withSession((token) => updateTeam(team.id, patch, token))
        }
      } else {
        await withSession((token) =>
          createTeam({ name: name.trim(), active }, token)
        )
      }
      onSaved()
    } catch (err) {
      showFailure(err)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title={team ? 'Edit team' : 'Add team'}
      onClose={onClose}
      busy={saving}
      actions={
        <div className="flex w-full gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            isLoading={saving}
            loadingText={team ? 'Saving…' : 'Creating…'}
            disabled={locked}
          >
            {team ? 'Save changes' : 'Create team'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5 pt-1">
        {banner && <Alert>{banner}</Alert>}

        {locked && (
          <Alert>
            Default Team cannot be renamed or deactivated — it is the fallback workspace for
            unmapped dialer traffic.
          </Alert>
        )}

        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={Boolean(problems.name)}
          helperText={problems.name}
          disabled={locked}
          autoFocus={!locked}
        />

        <Checkbox
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          disabled={locked}
          label={locked ? 'Active (Default Team must stay active)' : 'Active'}
        />
      </form>
    </Dialog>
  )
}
