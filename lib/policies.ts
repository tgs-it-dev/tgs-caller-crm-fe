import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'
import { formatDateTime, formatPhone } from '@/lib/format'
import { POLICY_STATUS_LABEL } from '@/lib/retention'

export type PolicyLookup = components['schemas']['PolicyLookupResponse']
export type PolicySale = components['schemas']['PolicySale']
export type PolicyNumberRow = components['schemas']['PolicyNumberRow']
export type PolicySkipped = components['schemas']['PolicySkipped']
export type PaidUpload = components['schemas']['PaidUploadResponse']

/** The sale behind each policy number in a CSV or Excel file, one number per row. */
export async function lookupPolicies(file: File, token: string): Promise<PolicyLookup> {
  const form = new FormData()
  form.append('file', file)
  // No Content-Type: the browser writes it, boundary included.
  const res = await fetch(apiUrl('/reporting/policy-lookup'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<PolicyLookup>
}

/**
 * Marks the sales a file matches as Paid for `month` (YYYY-MM). Send the file the
 * lookup was run on: the API reads it again and takes its matches afresh.
 */
export async function markPaid(file: File, month: string, token: string): Promise<PaidUpload> {
  const form = new FormData()
  form.append('month', month)
  form.append('file', file)
  const res = await fetch(apiUrl('/reporting/paid-uploads'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<PaidUpload>
}

/** Every Paid upload, standing or undone, newest first. */
export async function listPaidUploads(token: string): Promise<PaidUpload[]> {
  const res = await fetch(apiUrl('/reporting/paid-uploads'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return ((await res.json()) as components['schemas']['PaidUploadListResponse']).items
}

/** Takes an upload back. Its sales fall to the next upload that matched them, or to unpaid. */
export async function undoPaidUpload(id: string, token: string): Promise<PaidUpload> {
  const res = await fetch(apiUrl(`/reporting/paid-uploads/${encodeURIComponent(id)}/undo`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<PaidUpload>
}

/** A paid month, from its 1st or as YYYY-MM: "October 2026", or "Oct 2026" when short. */
export function formatMonth(month: string, style: 'long' | 'short' = 'long'): string {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number - 1, 1)).toLocaleString('en-US', {
    month: style,
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** The months a sale can be marked Paid for, as YYYY-MM: `today`'s and the 23 before it. */
export function recentMonths(today: string): string[] {
  const [year, month] = today.split('-').map(Number)
  return Array.from({ length: 24 }, (_, back) => {
    const at = new Date(Date.UTC(year, month - 1 - back, 1))
    return at.toISOString().slice(0, 7)
  })
}

export function skippedReason(row: PolicySkipped): string {
  return row.reason === 'duplicate'
    ? `Listed again, first on row ${row.first_row}`
    : 'Longer than 64 characters'
}

/**
 * One cell, quoted when it holds a comma, quote or line break. A cell that a
 * spreadsheet would run as a formula (=, +, -, @) gets a leading apostrophe, since
 * lead names come from outside the app.
 */
function cell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Every uploaded number with what became of it, in the order the file listed
 * them, so each line sits where it did in the upload. A number with two sales
 * takes two lines.
 */
export function policyResultCsv(result: PolicyLookup): string {
  const lines: { row: number; cells: (string | number | null)[] }[] = [
    ...result.matches.map((sale) => ({
      row: sale.row,
      cells: [
        sale.policy_number,
        'Matched',
        sale.lead_name,
        formatPhone(sale.lead_phone),
        sale.team_name,
        sale.closer_name,
        formatDateTime(sale.sold_at),
        sale.total_payment,
        sale.down_payment,
        sale.monthly_payment,
        sale.paid_month ? formatMonth(sale.paid_month) : 'Not paid',
        sale.policy_status ? POLICY_STATUS_LABEL[sale.policy_status] : null,
        null,
      ],
    })),
    ...result.unmatched.map((row) => ({
      row: row.row,
      cells: [row.policy_number, 'Not found', ...Array(11).fill(null)],
    })),
    ...result.skipped.map((row) => ({
      row: row.row,
      cells: [row.value, 'Skipped', ...Array(10).fill(null), skippedReason(row)],
    })),
  ]
  // A stable sort keeps a number's sales in the order the API gave them.
  lines.sort((a, b) => a.row - b.row)
  const header = [
    'Policy number',
    'Status',
    'Lead',
    'Phone',
    'Team',
    'Closer',
    'Sold',
    'Total',
    'Down',
    'Monthly',
    'Paid',
    'Policy status',
    'Note',
  ]
  // The byte order mark is what makes Excel read the file as UTF-8.
  const rows = [header, ...lines.map((line) => line.cells)]
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

/** Hands the browser a file to save. */
export function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
