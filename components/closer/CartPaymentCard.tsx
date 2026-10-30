'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthError } from '@/lib/auth'
import {
  EMPTY_CART_FORM,
  checkCart,
  digitsOf,
  fetchCart,
  formFromCart,
  formatAmountInput,
  formatExpiryInput,
  maskTail,
  problemsFromError,
  saveCart,
  toSaveRequest,
  type CartField,
  type CartForm,
  type CartProblems,
  type CartResponse,
} from '@/lib/cart'
import { CURRENCY_SYMBOL, formatDateTime, formatMoney } from '@/lib/format'
import { waitForMocking } from '@/lib/mockReady'
import { withSession } from '@/lib/session'

type LoadState =
  | { status: 'locked' }
  | { status: 'loading' }
  | { status: 'ready'; saved: CartResponse | null }
  | { status: 'error'; message: string }

/** Shown only while focused; masked the moment the closer leaves the field. */
const SENSITIVE: CartField[] = ['account_number', 'routing_number', 'cvv']
const AMOUNTS: CartField[] = ['total_payment', 'down_payment', 'monthly_payment']
const REPLACE_HINT = 'Saved. Type a new number to replace it.'

function loadMessage(err: unknown) {
  if (err instanceof AuthError && err.status === 404) return "This call's cart isn't available to you."
  return 'Could not load the cart. Please try again.'
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b-hairline border-light-grey py-2 last:border-b-0">
      <dt className="text-sm text-slate">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink tabular-nums">{children}</dd>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">{children}</h3>
  )
}

/**
 * The saved cart, laid out like the form it came from. Numbers stay masked, and
 * there is no CVV row: it is never saved.
 */
function SavedCart({ saved }: { saved: CartResponse }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <section>
        <SectionTitle>Cart</SectionTitle>
        <dl>
          <Row label="Account">•••• {saved.account_last4}</Row>
          <Row label="Routing">{saved.routing_last4 ? `•••• ${saved.routing_last4}` : '-'}</Row>
          <Row label="Expiry">{saved.expiry ?? '-'}</Row>
          <Row label="Policy">{saved.policy_number ?? '-'}</Row>
        </dl>
      </section>
      <section>
        <SectionTitle>Payment</SectionTitle>
        <dl>
          <Row label="Total">{formatMoney(saved.total_payment)}</Row>
          <Row label="Down">{formatMoney(saved.down_payment)}</Row>
          <Row label="Monthly">{formatMoney(saved.monthly_payment)}</Row>
        </dl>
      </section>
    </div>
  )
}

export function CartPaymentCard({
  interactionId,
  enabled,
  onCartLoaded,
}: {
  interactionId: string
  /** The transfer is accepted, so this closer may save the cart. */
  enabled: boolean
  /** Whether the call has a saved cart, once that is known. */
  onCartLoaded: (saved: boolean) => void
}) {
  const [load, setLoad] = useState<LoadState>({ status: enabled ? 'loading' : 'locked' })
  const [form, setForm] = useState<CartForm>(EMPTY_CART_FORM)
  const [problems, setProblems] = useState<CartProblems>({})
  const [focused, setFocused] = useState<CartField | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  // Adjusting state during render, not in an effect, when the lock lifts or
  // the call changes: the lint rule this repo enforces forbids the effect form.
  const [loadKey, setLoadKey] = useState({ interactionId, enabled })
  if (loadKey.interactionId !== interactionId || loadKey.enabled !== enabled) {
    if (loadKey.interactionId !== interactionId) {
      // Nothing typed for one call may linger into another.
      setForm(EMPTY_CART_FORM)
      setProblems({})
      setBanner(null)
      setEditing(false)
    }
    setLoadKey({ interactionId, enabled })
    setLoad({ status: enabled ? 'loading' : 'locked' })
  }

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    waitForMocking()
      .then(() => withSession((token) => fetchCart(interactionId, token)))
      .then((saved) => {
        if (cancelled) return
        setLoad({ status: 'ready', saved })
        setForm(saved ? formFromCart(saved) : EMPTY_CART_FORM)
        onCartLoaded(Boolean(saved))
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: 'error', message: loadMessage(err) })
      })

    return () => {
      cancelled = true
    }
  }, [interactionId, enabled, onCartLoaded])

  const saved = load.status === 'ready' ? load.saved : null
  const showForm = !saved || editing
  const locked = load.status !== 'ready' || saving

  function update(field: CartField, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function leave(field: CartField) {
    setFocused(null)
    const next = AMOUNTS.includes(field)
      ? { ...form, [field]: formatAmountInput(form[field]) }
      : form
    if (next !== form) setForm(next)
    // Recheck what this field decides, so a fixed value clears its message.
    const found = checkCart(next, { saved: Boolean(saved) })
    setProblems((current) => {
      const updated = { ...current, payments: undefined }
      const touched = AMOUNTS.includes(field) ? AMOUNTS : [field]
      for (const name of touched) {
        if (name === field || current[name]) updated[name] = found[name]
      }
      return updated
    })
  }

  function shown(field: CartField) {
    const value = form[field]
    if (!SENSITIVE.includes(field) || focused === field || !value) return value
    const digits = digitsOf(value)
    return field === 'cvv' ? '•'.repeat(digits.length) : maskTail(digits)
  }

  function startEditing(on: boolean) {
    setEditing(on)
    setProblems({})
    setBanner(null)
    if (saved) setForm(formFromCart(saved))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = checkCart(form, { saved: Boolean(saved) })
    setProblems(found)
    setBanner(null)
    if (Object.values(found).some(Boolean)) return

    setSaving(true)
    try {
      const next = await withSession((token) => saveCart(interactionId, toSaveRequest(form), token))
      setLoad({ status: 'ready', saved: next })
      setForm(formFromCart(next))
      setEditing(false)
      onCartLoaded(true)
    } catch (err) {
      const named = problemsFromError(err)
      if (named) setProblems(named)
      else setBanner(err instanceof Error ? err.message : 'Could not save the cart. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function field(
    name: CartField,
    label: string,
    hint: string,
    extra: { required?: boolean; amount?: boolean; maxLength?: number; placeholder?: string } = {}
  ) {
    return (
      <Input
        label={label}
        value={shown(name)}
        onChange={(e) =>
          update(
            name,
            name === 'expiry' ? formatExpiryInput(e.target.value, form.expiry) : e.target.value
          )
        }
        onFocus={() => setFocused(name)}
        onBlur={() => leave(name)}
        disabled={locked}
        required={extra.required}
        error={Boolean(problems[name])}
        helperText={problems[name] ?? hint}
        autoComplete="off"
        inputMode={extra.amount ? 'decimal' : 'numeric'}
        maxLength={extra.maxLength}
        placeholder={extra.placeholder}
        startAdornment={extra.amount ? CURRENCY_SYMBOL : undefined}
      />
    )
  }

  const savedRouting = saved?.routing_last4

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col rounded-xl border-hairline border-slate bg-white p-6"
    >
      <div className="flex items-baseline justify-between gap-4 border-b-hairline border-light-grey pb-4">
        <h2 className="text-lg font-medium leading-[120%] text-ink">Cart & Payment</h2>
        {saved && (
          <p className="text-xs text-slate">Saved {formatDateTime(saved.updated_at)}</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {load.status === 'locked' && (
          <p className="text-sm leading-[150%] text-slate">
            Cart unlocks after the transfer is accepted.
          </p>
        )}
        {load.status === 'loading' && (
          <p className="text-sm leading-[150%] text-slate">Loading the cart…</p>
        )}
        {load.status === 'error' && <Alert>{load.message}</Alert>}

        {saved && !editing && <SavedCart saved={saved} />}

        {showForm && (
          <>
            <fieldset className="flex flex-col gap-4" disabled={locked}>
              <legend className="mb-2 text-sm font-medium text-ink">Cart</legend>
              {field(
                'account_number',
                'Account number',
                saved ? REPLACE_HINT : 'Digits only; spaces and dashes are fine.',
                {
                  required: !saved,
                  maxLength: 23,
                  placeholder: saved ? `•••• ${saved.account_last4}` : undefined,
                }
              )}
              <div className="grid grid-cols-2 gap-4">
                {field('expiry', 'Expiry (optional)', 'MM/YY', {
                  maxLength: 5,
                  placeholder: 'MM/YY',
                })}
                {field('cvv', 'CVV (optional)', 'Checked, never stored.', { maxLength: 4 })}
              </div>
              {field(
                'routing_number',
                'Routing number (optional)',
                savedRouting ? REPLACE_HINT : '9 digits.',
                {
                  maxLength: 11,
                  placeholder: savedRouting ? `•••• ${savedRouting}` : undefined,
                }
              )}
              <Input
                label="Policy number (optional)"
                value={form.policy_number}
                onChange={(e) => update('policy_number', e.target.value)}
                onBlur={() => leave('policy_number')}
                disabled={locked}
                error={Boolean(problems.policy_number)}
                helperText={problems.policy_number ?? 'Add it now or once it is issued.'}
                autoComplete="off"
                maxLength={64}
              />
            </fieldset>

            <fieldset className="flex flex-col gap-4" disabled={locked}>
              <legend className="mb-2 text-sm font-medium text-ink">Payment</legend>
              {field('total_payment', 'Total payment', 'The whole sale.', {
                required: true,
                amount: true,
              })}
              <div className="grid grid-cols-2 gap-4">
                {field('down_payment', 'Down payment', 'Paid today.', {
                  required: true,
                  amount: true,
                })}
                {field('monthly_payment', 'Monthly payment', 'Each month after.', {
                  required: true,
                  amount: true,
                })}
              </div>
              {problems.payments && <Alert>{problems.payments}</Alert>}
            </fieldset>
          </>
        )}

        {banner && <Alert>{banner}</Alert>}
      </div>

      {/* Keyed: reusing one <button> for Edit and Save would turn the click on
          Edit into a submit, since the mode switches before the click ends. */}
      <div className="mt-6 flex gap-3">
        {showForm ? (
          <>
            <Button
              key="save"
              type="submit"
              disabled={locked}
              isLoading={saving}
              loadingText="Saving…"
            >
              Save Cart
            </Button>
            {saved && (
              <Button
                key="cancel"
                type="button"
                variant="secondary"
                onClick={() => startEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            )}
          </>
        ) : (
          <Button
            key="edit"
            type="button"
            variant="secondary"
            onClick={() => startEditing(true)}
          >
            Edit cart
          </Button>
        )}
      </div>
    </form>
  )
}
