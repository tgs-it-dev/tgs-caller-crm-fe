import type { components } from '@/lib/generated/schema'

export type ErrorResponse = components['schemas']['ErrorResponse']
export type FieldError = components['schemas']['FieldError']

/** A failed response, read into one shape whatever arrived. */
export type ApiErrorInfo = {
  status: number
  /** Stable — branch on this, never on `message`. */
  code: string
  message: string
  fields: FieldError[]
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  const candidate = body as Partial<ErrorResponse> | null
  return typeof candidate?.detail === 'string' && typeof candidate.code === 'string'
}

/**
 * Every error the API returns is `{detail, code, fields?}`. Something in between
 * may answer instead — a proxy's HTML 502, say — so anything else gets a code
 * from the status and a generic message.
 */
export async function readApiError(res: Response): Promise<ApiErrorInfo> {
  const body: unknown = await res.json().catch(() => null)
  if (isErrorResponse(body)) {
    return { status: res.status, code: body.code, message: body.detail, fields: body.fields ?? [] }
  }
  return {
    status: res.status,
    code: `http_${res.status}`,
    message: 'Something went wrong. Please try again.',
    fields: [],
  }
}
