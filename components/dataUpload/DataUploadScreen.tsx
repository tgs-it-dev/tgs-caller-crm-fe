'use client'

import { useState } from 'react'
import { AgentWorkUploadTab } from '@/components/dataUpload/AgentWorkUploadTab'
import { PastUploadsTab } from '@/components/dataUpload/PastUploadsTab'
import { UsersUploadTab } from '@/components/dataUpload/UsersUploadTab'
import { PageShell } from '@/components/ui/PageShell'

type Tab = 'users' | 'work' | 'past'

const TABS: readonly { value: Tab; label: string }[] = [
  { value: 'users', label: 'Users' },
  { value: 'work', label: 'Agent work' },
  { value: 'past', label: 'Past uploads' },
]

/** A Super Admin brings in staff, and the work their agents already did. */
export function DataUploadScreen() {
  const [tab, setTab] = useState<Tab>('users')
  const [uploads, setUploads] = useState(0)
  return (
    <PageShell title="Data upload">
      <p className="-mt-2 mb-4 text-sm text-slate">
        Bring your staff, and the work your fronters and closers have already done, into the CRM.
      </p>
      <div role="tablist" aria-label="Data upload" className="mb-5 flex flex-wrap gap-6 border-b-hairline border-slate">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors ${
              tab === value ? 'border-navy text-ink' : 'border-transparent text-slate hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Kept mounted, so switching tabs never loses a checked file or a sign-in list. */}
      <div hidden={tab !== 'users'}>
        <UsersUploadTab />
      </div>
      <div hidden={tab !== 'work'}>
        <AgentWorkUploadTab onUploaded={() => setUploads((n) => n + 1)} />
      </div>
      {tab === 'past' && <PastUploadsTab version={uploads} />}
    </PageShell>
  )
}
