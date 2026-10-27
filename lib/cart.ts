import type { components } from '@/lib/generated/schema'
import { apiUrl } from '@/lib/apiUrl'
import { AuthError, authError } from '@/lib/auth'

export type CartResponse = components['schemas']['CartResponse']
export type CartSaveRequest = components['schemas']['CartSaveRequest']

/** What the closer types. Account, routing and CVV never come back from the API. */
export type CartForm = {
  account_number: string
  routing_number: string
  expiry: string
  cvv: string
  policy_number: string
  total_payment: string
  down_payment: string
  monthly_payment: string
}

export type CartField = keyof CartForm

/** Problems by field; `payments` holds the API's payment rule when it names no field. */
export type CartProblems = Partial<Record<CartField | 'payments', string>>

export const EMPTY_CART_FORM: CartForm = {
  account_number: '',
  routing_number: '',
  expiry: '',
  cvv: '',
  policy_number: '',
  total_payment: '',
  down_payment: '',
  monthly_payment: '',
}

async function json<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) throw await authError(res)
  return res.json() as Promise<T>
}

/** The call's cart, or null before anything is saved. */
export function fetchCart(interactionId: string, token: string): Promise<CartResponse | null> {
  return json<CartResponse | null>(`/interactions/${interactionId}/cart`, token)
}

export function saveCart(
  interactionId: string,
  body: CartSaveRequest,
  token: string
): Promise<CartResponse> {
  return json<CartResponse>(`/interactions/${interactionId}/cart`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function digitsOf(text: string) {
  return text.replace(/[\s-]/g, '')
}

/** The last four digits, or fewer for a short number, the same rule as the API. */
export function visibleTail(digits: string) {
  const keep = Math.min(4, Math.floor(digits.length / 2))
  return digits.slice(digits.length - keep)
}

/** "•••• 1234". */
export function maskTail(digits: string) {
  return `•••• ${visibleTail(digits)}`
}

/**
 * Expiry as it is typed: digits only, with the "/" added once the month is in.
 * Deleting back over the slash removes it rather than adding it straight back.
 */
export function formatExpiryInput(typed: string, previous: string) {
  const digits = typed.replace(/\D/g, '').slice(0, 4)
  if (digits.length < 2) return digits
  if (digits.length === 2) return typed.length < previous.length ? digits : `${digits}/`
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

const AMOUNT = /^\d+(\.\d{1,2})?$/

/** "$1,234.5" as the API wants it, "1234.50", or null when it is not an amount. */
export function toAmount(text: string): string | null {
  const plain = text.replace(/[$,\s]/g, '')
  return AMOUNT.test(plain) ? Number(plain).toFixed(2) : null
}

const grouped = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** An amount field's text once the closer leaves it: "1,234.50", or as typed if not an amount. */
export function formatAmountInput(text: string) {
  const amount = toAmount(text)
  return amount === null ? text : grouped.format(Number(amount))
}

function cents(amount: string) {
  return Math.round(Number(amount) * 100)
}

/**
 * The same rules the API applies, so most mistakes show before a save. Once a
 * cart is saved, a blank account or routing number keeps the saved one.
 */
export function checkCart(
  form: CartForm,
  { saved = false, now = new Date() }: { saved?: boolean; now?: Date } = {}
): CartProblems {
  const found: CartProblems = {}

  const account = digitsOf(form.account_number)
  if (!account && !saved) found.account_number = 'Enter the account number.'
  else if (account && !/^\d{4,19}$/.test(account)) found.account_number = 'Use 4 to 19 digits.'

  const routing = digitsOf(form.routing_number)
  if (routing && !/^\d{9}$/.test(routing)) found.routing_number = 'Use 9 digits.'

  const cvv = digitsOf(form.cvv)
  if (cvv && !/^\d{3,4}$/.test(cvv)) found.cvv = 'Use 3 or 4 digits.'

  const expiry = form.expiry.trim()
  if (expiry) {
    const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry)
    if (!match) found.expiry = 'Use MM/YY, for example 08/29.'
    else if (
      2000 + Number(match[2]) < now.getUTCFullYear() ||
      (2000 + Number(match[2]) === now.getUTCFullYear() && Number(match[1]) < now.getUTCMonth() + 1)
    )
      found.expiry = 'This card has expired.'
  }

  if (form.policy_number.trim().length > 64) found.policy_number = 'Use 64 characters or fewer.'

  const total = toAmount(form.total_payment)
  const down = toAmount(form.down_payment)
  const monthly = toAmount(form.monthly_payment)
  if (total === null) found.total_payment = 'Enter an amount, such as 1,800.00.'
  else if (cents(total) === 0) found.total_payment = 'The total must be more than zero.'
  if (down === null) found.down_payment = 'Enter an amount, or 0.'
  if (monthly === null) found.monthly_payment = 'Enter an amount, or 0.'
  // Compared only once each amount stands on its own, as the API does.
  if (found.total_payment || down === null || monthly === null || total === null) return found
  if (cents(down) > cents(total))
    found.down_payment = "The down payment can't be more than the total."
  else if (cents(monthly) > cents(total) - cents(down))
    found.monthly_payment = "The monthly payment can't be more than the total less the down payment."

  return found
}

/**
 * The request for a form that passed `checkCart`. A blank account or routing
 * number is left out, which keeps the saved one.
 */
export function toSaveRequest(form: CartForm): CartSaveRequest {
  const optional = (text: string) => text || null
  const account = digitsOf(form.account_number)
  const routing = digitsOf(form.routing_number)
  return {
    ...(account ? { account_number: account } : {}),
    ...(routing ? { routing_number: routing } : {}),
    expiry: optional(form.expiry.trim()),
    cvv: optional(digitsOf(form.cvv)),
    policy_number: optional(form.policy_number.trim()),
    total_payment: toAmount(form.total_payment) ?? '',
    down_payment: toAmount(form.down_payment) ?? '',
    monthly_payment: toAmount(form.monthly_payment) ?? '',
  }
}

/** A saved cart back in the form: what can be shown again, never the numbers. */
export function formFromCart(cart: CartResponse): CartForm {
  return {
    ...EMPTY_CART_FORM,
    expiry: cart.expiry ?? '',
    policy_number: cart.policy_number ?? '',
    total_payment: formatAmountInput(cart.total_payment),
    down_payment: formatAmountInput(cart.down_payment),
    monthly_payment: formatAmountInput(cart.monthly_payment),
  }
}

const FORM_FIELDS = new Set<string>(Object.keys(EMPTY_CART_FORM))

/** A refused save, as field problems where the API named one. Null for anything else. */
export function problemsFromError(err: unknown): CartProblems | null {
  if (!(err instanceof AuthError) || err.status !== 422 || err.fields.length === 0) return null
  const found: CartProblems = {}
  for (const field of err.fields) {
    const message = field.message.replace(/^Value error, /, '')
    const key = field.field && FORM_FIELDS.has(field.field) ? (field.field as CartField) : 'payments'
    const sentence = message.charAt(0).toUpperCase() + message.slice(1)
    found[key] = sentence.endsWith('.') ? sentence : `${sentence}.`
  }
  return found
}
