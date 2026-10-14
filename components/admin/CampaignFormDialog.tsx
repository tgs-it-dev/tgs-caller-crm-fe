'use client'

import { useId, useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { AuthError } from '@/lib/auth'
import {
  createCampaign,
  updateCampaign,
  type Campaign,
  type CampaignPatch,
} from '@/lib/campaigns'
import { withSession } from '@/lib/session'
import type { Team } from '@/lib/teams'

/** Copy for the codes whose own wording is written for an API, not a person. */
const FIELD_COPY: Record<string, string> = {
  'campaign.already_exists': 'A campaign with this name already exists.',
}

function bannerFor(err: AuthError): string {
  if (err.code === 'campaign.not_found') return 'That campaign no longer exists.'
  if (err.code === 'team.not_found') {
    return 'One of the selected teams no longer exists. Reload and try again.'
  }
  if (err.status === 403) return 'You no longer have access to campaign administration.'
  if (err.status === 401) return 'Your session has ended. Please sign in again.'
  return err.message
}

const sameTeams = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id) => b.includes(id))

export function CampaignFormDialog({
  campaign,
  teams,
  onClose,
  onSaved,
}: {
  /** The campaign being edited, or null to add one. */
  campaign: Campaign | null
  /** Every team; a campaign may be worked by none, one or several. */
  teams: Team[]
  onClose: () => void
  onSaved: () => void
}) {
  const formId = useId()
  const [name, setName] = useState(campaign?.name ?? '')
  const [teamIds, setTeamIds] = useState<string[]>(campaign?.team_ids ?? [])
  const [active, setActive] = useState(campaign?.active ?? true)
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function toggleTeam(id: string) {
    setTeamIds((ticked) =>
      ticked.includes(id) ? ticked.filter((teamId) => teamId !== id) : [...ticked, id]
    )
  }

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
    // Only Name can show an error of its own; anything else goes in the banner.
    const named = err.fields.filter((field) => field.field === 'name')
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
    const found = checkHere()
    setProblems(found)
    setBanner(null)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      if (campaign) {
        const patch: CampaignPatch = {}
        if (name.trim() !== campaign.name) patch.name = name.trim()
        if (active !== campaign.active) patch.active = active
        if (!sameTeams(teamIds, campaign.team_ids)) patch.team_ids = teamIds
        if (Object.keys(patch).length > 0) {
          await withSession((token) => updateCampaign(campaign.id, patch, token))
        }
      } else {
        await withSession((token) =>
          createCampaign({ name: name.trim(), active, team_ids: teamIds }, token)
        )
      }
      onSaved()
    } catch (err) {
      showFailure(err)
      setSaving(false)
    }
  }

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Dialog
      open
      title={campaign ? 'Edit campaign' : 'Add campaign'}
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
            loadingText={campaign ? 'Saving…' : 'Creating…'}
          >
            {campaign ? 'Save changes' : 'Create campaign'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5 pt-1">
        {banner && <Alert>{banner}</Alert>}

        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={Boolean(problems.name)}
          helperText={problems.name}
          maxLength={255}
          autoFocus
        />

        <fieldset>
          <legend className="mb-3 text-sm font-medium text-black">Teams</legend>
          {sortedTeams.length > 0 ? (
            // A column: each control is an inline-flex label, so they would
            // otherwise run together on one line.
            <div className="flex flex-col items-start gap-2">
              {sortedTeams.map((team) => (
                <Checkbox
                  key={team.id}
                  label={team.active ? team.name : `${team.name} (inactive)`}
                  checked={teamIds.includes(team.id)}
                  onChange={() => toggleTeam(team.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs leading-[150%] text-slate">
              No teams yet — add one on the Teams tab.
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-medium text-black">Status</legend>
          <Checkbox
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            label="Active"
          />
          <p className="mt-2 text-xs leading-[150%] text-slate">
            Turn off to retire the campaign; it stays on the list.
          </p>
        </fieldset>
      </form>
    </Dialog>
  )
}
