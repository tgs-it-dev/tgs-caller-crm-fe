import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'
import { formatDateTime, formatPhone } from '@/lib/format'

export type PolicyLookup = components['schemas']['PolicyLookupResponse']
export type PolicySale = components['schemas']['PolicySale']
export type PolicyNumberRow = components['schemas']['PolicyNumberRow']
export type PolicySkipped = components['schemas']['PolicySkipped']

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
        null,
      ],
    })),
    ...result.unmatched.map((row) => ({
      row: row.row,
      cells: [row.policy_number, 'Not found', ...Array(9).fill(null)],
    })),
    ...result.skipped.map((row) => ({
      row: row.row,
      cells: [row.value, 'Skipped', ...Array(8).fill(null), skippedReason(row)],
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
