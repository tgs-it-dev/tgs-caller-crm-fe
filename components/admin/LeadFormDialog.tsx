'use client'

import { useId, useState, type FormEvent } from 'react'
import {
  CAMPAIGN_PROBLEMS,
  LeadCampaignSelect,
  campaignMissing,
  initialCampaignId,
} from '@/components/admin/LeadCampaignSelect'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { AuthError } from '@/lib/auth'
import type { Campaign } from '@/lib/campaigns'
import { formatDate } from '@/lib/format'
import { createLead, findLeadOnTeam } from '@/lib/leads'
import { withSession } from '@/lib/session'

const PHONE_PROBLEMS: Record<string, string> = {
  'lead.invalid_phone': 'Enter a valid phone number.',
  'lead.phone_suppressed': 'This number is on the company do-not-call list.',
}

function bannerFor(err: AuthError): string {
  if (err.code === 'lead.team_required') {
    return 'You are not on a team yet, so you cannot add leads.'
  }
  if (err.status === 403) return 'You no longer have access to lead management.'
  if (err.status === 401) return 'Your session has ended. Please sign in again.'
  return err.message
}

export function LeadFormDialog({
  campaigns,
  onClose,
  onSaved,
}: {
  /** The team's active campaigns. */
  campaigns: Campaign[]
  onClose: () => void
  onSaved: () => void
}) {
  const formId = useId()
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [campaignId, setCampaignId] = useState(initialCampaignId(campaigns))
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function checkHere(): Record<string, string> {
    const found: Record<string, string> = {}
    if (!phone.trim()) found.phone = 'Enter a phone number.'
    if (campaignMissing(campaigns, campaignId)) found.campaign_id = 'Select a campaign.'
    return found
  }

  function showFailure(err: unknown) {
    if (!(err instanceof AuthError)) {
      setBanner('Something went wrong. Please try again.')
      return
    }
    if (PHONE_PROBLEMS[err.code]) {
      setProblems({ phone: PHONE_PROBLEMS[err.code] })
      return
    }
    if (CAMPAIGN_PROBLEMS[err.code]) {
      setProblems({ campaign_id: CAMPAIGN_PROBLEMS[err.code] })
      return
    }
    // A request the API could not read names its input; anything else goes up top.
    const named = err.fields.filter((field) => field.field === 'phone' || field.field === 'name')
    if (named.length > 0) {
      setProblems(Object.fromEntries(named.map((field) => [field.field as string, field.message])))
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
      // POST /leads answers 201 for a number the team already has, so ask first.
      const existing = await withSession((token) => findLeadOnTeam(phone.trim(), token))
      if (existing) {
        const added = formatDate(existing.created_at)
        setProblems({
          phone: `This number is already on your team (added ${added}). It was not added again.`,
        })
        setSaving(false)
        return
      }
      await withSession((token) =>
        createLead(
          {
            phone: phone.trim(),
            source: 'manual',
            // The API refuses an empty name, so a blank one is left out.
            ...(name.trim() ? { name: name.trim() } : {}),
            ...(campaignId ? { campaign_id: campaignId } : {}),
          },
          token
        )
      )
      onSaved()
    } catch (err) {
      showFailure(err)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title="Add lead"
      onClose={onClose}
      busy={saving}
      actions={
        <div className="flex w-full gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} loadingText="Adding…">
            Add lead
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5 pt-1">
        {banner && <Alert>{banner}</Alert>}

        <Input
          label="Phone"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={Boolean(problems.phone)}
          helperText={problems.phone ?? 'Include the area code, for example (212) 555-0100.'}
          maxLength={32}
          autoFocus
        />

        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={Boolean(problems.name)}
          helperText={problems.name ?? 'Optional. Fronters see it on their queue.'}
          maxLength={255}
        />

        <LeadCampaignSelect
          campaigns={campaigns}
          value={campaignId}
          onChange={setCampaignId}
          error={problems.campaign_id}
        />
      </form>
    </Dialog>
  )
}
