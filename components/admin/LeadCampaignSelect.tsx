'use client'

import { Select } from '@/components/ui/Select'
import type { Campaign } from '@/lib/campaigns'

const NO_LONGER_USABLE = 'That campaign can no longer be used. Reload and pick another.'

/** The API's campaign refusals, worded for the field they belong under. */
export const CAMPAIGN_PROBLEMS: Record<string, string> = {
  'lead.campaign_required': 'Select a campaign.',
  'lead.campaign_inactive': NO_LONGER_USABLE,
  'lead.campaign_not_on_team': NO_LONGER_USABLE,
  'campaign.not_found': NO_LONGER_USABLE,
}

/** A team with one active campaign starts on it; with several, someone has to pick. */
export function initialCampaignId(campaigns: Campaign[]): string {
  return campaigns.length === 1 ? campaigns[0].id : ''
}

export function campaignMissing(campaigns: Campaign[], campaignId: string): boolean {
  return campaigns.length > 1 && !campaignId
}

/**
 * The campaign that labels new leads on the fronter queue.
 *
 * Mirrors the API: with no active campaign there is nothing to choose and the
 * queue says "Manual upload"; one is used as it is; several need a pick.
 */
export function LeadCampaignSelect({
  campaigns,
  value,
  onChange,
  error,
}: {
  /** The team's active campaigns. */
  campaigns: Campaign[]
  value: string
  onChange: (campaignId: string) => void
  error?: string
}) {
  if (campaigns.length === 0) return null

  return (
    <div>
      <Select
        label="Campaign"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={campaigns.length > 1}
      >
        {campaigns.length > 1 && <option value="">Select a campaign</option>}
        {[...campaigns]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
      </Select>
      {error && (
        <p role="alert" className="mt-2 text-xs leading-[150%] text-status-red">
          {error}
        </p>
      )}
    </div>
  )
}
