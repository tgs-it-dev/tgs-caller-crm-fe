import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { authError } from '@/lib/auth'

export type DataImportItem = components['schemas']['DataImportItem']
export type UserUploadCheck = components['schemas']['UserUploadCheck']
export type UserUploadRow = components['schemas']['UserUploadRow']
export type UploadProblem = components['schemas']['UploadProblem']
export type UploadNote = components['schemas']['UploadNote']
export type SignInDetails = components['schemas']['SignInDetails']
export type UserUploadResponse = components['schemas']['UserUploadResponse']
export type NewPasswordsResponse = components['schemas']['NewPasswordsResponse']
export type SignInFiles = components['schemas']['SignInFiles']
export type UploadRole = SignInDetails['role']
export type AgentWorkCheck = components['schemas']['AgentWorkCheck']
export type AgentWorkTeam = components['schemas']['AgentWorkTeam']
export type FronterNumbers = components['schemas']['FronterNumbers']
export type CloserNumbers = components['schemas']['CloserNumbers']
export type DateOrder = 'mdy' | 'dmy'
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export type TemplateKind = 'users' | 'agent-work'

export const UPLOAD_ROLE_LABEL: Record<UploadRole, string> = {
  administrator: 'Team Admin',
  fronter: 'Fronter',
  closer: 'Closer',
}

async function json<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<T>
}

function withFile(file: File, fields: Record<string, string> = {}): RequestInit {
  const form = new FormData()
  form.append('file', file)
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  // No Content-Type: the browser writes it, boundary included.
  return { method: 'POST', body: form }
}

/** Every upload, newest first. */
export async function listUploads(token: string): Promise<DataImportItem[]> {
  return (await json<{ items: DataImportItem[] }>('/data-imports', token)).items
}

/** Saves the template to the person's computer, built fresh by the API. */
export async function downloadTemplate(kind: TemplateKind, token: string): Promise<void> {
  const res = await fetch(apiUrl(`/data-imports/templates/${kind}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw await authError(res)
  saveBlob(await res.blob(), `${kind}-template.xlsx`)
}

export function checkUsers(file: File, token: string): Promise<UserUploadCheck> {
  return json<UserUploadCheck>('/data-imports/users/check', token, withFile(file))
}

export function uploadUsers(file: File, token: string): Promise<UserUploadResponse> {
  return json<UserUploadResponse>('/data-imports/users', token, withFile(file))
}

export function checkAgentWork(file: File, order: DateOrder, token: string): Promise<AgentWorkCheck> {
  return json<AgentWorkCheck>('/data-imports/agent-work/check', token, withFile(file, { date_order: order }))
}

export async function uploadAgentWork(file: File, order: DateOrder, token: string): Promise<DataImportItem> {
  const path = '/data-imports/agent-work'
  return (await json<{ upload: DataImportItem }>(path, token, withFile(file, { date_order: order }))).upload
}

/** Takes an agent work upload back out; refused (409) once anyone has worked on it. */
export function undoUpload(uploadId: string, token: string): Promise<DataImportItem> {
  return json<DataImportItem>(`/data-imports/${encodeURIComponent(uploadId)}/undo`, token, { method: 'POST' })
}

export function newPasswords(uploadId: string, token: string): Promise<NewPasswordsResponse> {
  const path = `/data-imports/${encodeURIComponent(uploadId)}/passwords`
  return json<NewPasswordsResponse>(path, token, { method: 'POST' })
}

export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Saves an Excel file the API sent base64-encoded, such as the sign-in list. */
export function saveSpreadsheet(encoded: string, name: string): void {
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
  saveBlob(new Blob([bytes], { type: XLSX_TYPE }), name)
}
