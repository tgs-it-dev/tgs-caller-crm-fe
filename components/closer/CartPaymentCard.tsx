'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import MuiButton from '@mui/material/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { AuthError } from '@/lib/auth'
import { requestCardEdit, type CardEditRequestItem } from '@/lib/callbacks'
import {
  EMPTY_CART_FORM,
  caretAfterDigits,
  checkCart,
  digitsOf,
  fetchCart,
  formFromCart,
  formatAccountNumberInput,
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

type CardEdit = CartResponse['card_edit']

/** Shown only while focused; masked the moment the closer leaves the field. */
const SENSITIVE: CartField[] = ['account_number', 'routing_number', 'cvv']
const AMOUNTS: CartField[] = ['total_payment', 'down_payment', 'monthly_payment']
const REPLACE_HINT = 'Saved. Type a new number to replace it.'
/** How often a waiting request checks for the Super Admin's answer. */
const WAITING_POLL_MS = 30_000

function loadMessage(err: unknown) {
  if (err instanceof AuthError && err.status === 404) return "This call's card isn't available to you."
  return 'Could not load the card. Please try again.'
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

function CardRows({ saved }: { saved: CartResponse }) {
  return (
    <>
      <Row label="Account">•••• {saved.account_last4}</Row>
      <Row label="Routing">{saved.routing_last4 ? `•••• ${saved.routing_last4}` : '-'}</Row>
      <Row label="Expiry">{saved.expiry ?? '-'}</Row>
    </>
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
        <SectionTitle>Card</SectionTitle>
        <dl>
          <CardRows saved={saved} />
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

/** Where changing the saved card on a callback stands, and the way to ask. */
function CardEditStatus({ cardEdit, onRequest }: { cardEdit: CardEdit; onRequest: () => void }) {
  const ask = (label: string) => (
    <div>
      <MuiButton size="small" variant="outlined" color="primary" onClick={onRequest}>
        {label}
      </MuiButton>
    </div>
  )
  const body: Partial<Record<CardEdit, { badge: ReactNode; text: string; action?: ReactNode }>> = {
    needs_approval: {
      badge: <Badge tone="neutral">Locked</Badge>,
      text: "Changing the card needs a Super Admin's approval. The policy number and payments can still change.",
      action: ask('Request to edit card'),
    },
    waiting: {
      badge: <Badge tone="amber">Waiting for approval</Badge>,
      text: 'A Super Admin will review your request. This updates by itself.',
    },
    approved: {
      badge: <Badge tone="done">Approved</Badge>,
      text: 'You can change the card once. It locks again after you save.',
    },
    rejected: {
      badge: <Badge tone="red">Rejected</Badge>,
      text: 'A Super Admin rejected the edit, so the card stays as it is.',
      action: ask('Request again'),
    },
  }
  const shown = body[cardEdit]
  if (!shown) return null
  return (
    <div className="flex flex-col gap-2 rounded-lg border-hairline border-light-grey p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">Card changes</span>
        {shown.badge}
      </div>
      <p className="text-sm leading-[150%] text-slate">{shown.text}</p>
      {shown.action}
    </div>
  )
}

function RequestEditDialog({
  interactionId,
  onClose,
  onSent,
}: {
  interactionId: string
  onClose: () => void
  onSent: (item: CardEditRequestItem) => void
}) {
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function send() {
    setSending(true)
    setProblem(null)
    try {
      await waitForMocking()
      onSent(
        await withSession((token) => requestCardEdit(interactionId, reason.trim() || null, token))
      )
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not send the request. Try again.')
      setSending(false)
    }
  }

  return (
    <Dialog
      open
      title="Request to edit card"
      onClose={onClose}
      busy={sending}
      actions={
        <div className="flex w-full gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void send()} isLoading={sending} loadingText="Sending…">
            Send
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm leading-[150%] text-body-text">
        A Super Admin reviews this. Once approved, you can change the card once.
      </p>
      <Textarea
        label="Why? (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        rows={3}
      />
      {problem && (
        <p role="alert" className="mt-2 text-sm leading-[150%] text-status-red">
          {problem}
        </p>
      )}
    </Dialog>
  )
}

export function CartPaymentCard({
  interactionId,
  enabled,
  readOnly = false,
  reloadKey = 0,
  onCartLoaded,
}: {
  interactionId: string
  /** The transfer is accepted, so this closer may save the cart. */
  enabled: boolean
  /** The call is closed to its closer: the saved cart shows, and nothing changes. */
  readOnly?: boolean
  /** Changes when the call's outcome does, which can lock or free the card. */
  reloadKey?: number
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
  const [requesting, setRequesting] = useState(false)

  // Adjusting state during render, not in an effect, when the lock lifts or
  // the call changes: the lint rule this repo enforces forbids the effect form.
  const [loadKey, setLoadKey] = useState({ interactionId, enabled, reloadKey })
  if (
    loadKey.interactionId !== interactionId ||
    loadKey.enabled !== enabled ||
    loadKey.reloadKey !== reloadKey
  ) {
    if (loadKey.interactionId !== interactionId) {
      // Nothing typed for one call may linger into another.
      setForm(EMPTY_CART_FORM)
      setBanner(null)
    }
    setProblems({})
    setEditing(false)
    setLoadKey({ interactionId, enabled, reloadKey })
    if (loadKey.interactionId !== interactionId || loadKey.enabled !== enabled) {
      setLoad({ status: enabled ? 'loading' : 'locked' })
    }
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
  }, [interactionId, enabled, reloadKey, onCartLoaded])

  const saved = load.status === 'ready' ? load.saved : null
  const cardEdit: CardEdit = saved?.card_edit ?? 'open'
  // On a callback the saved numbers and expiry change only with a Super Admin's approval.
  const cardLocked =
    cardEdit === 'needs_approval' || cardEdit === 'waiting' || cardEdit === 'rejected'

  // While a request waits, look for the answer now and then, and whenever the closer comes back.
  useEffect(() => {
    if (cardEdit !== 'waiting' || editing) return
    const check = () => {
      withSession((token) => fetchCart(interactionId, token))
        .then((next) => setLoad({ status: 'ready', saved: next }))
        .catch(() => undefined)
    }
    const timer = window.setInterval(check, WAITING_POLL_MS)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [cardEdit, editing, interactionId])

  const showForm = !readOnly && (!saved || editing)
  const locked = load.status !== 'ready' || saving

  function update(field: CartField, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function typeAccountNumber(input: HTMLInputElement) {
    const caret = input.selectionStart ?? input.value.length
    const digitsBefore = input.value.slice(0, caret).replace(/\D/g, '').length
    const value = formatAccountNumberInput(input.value)
    update('account_number', value)
    // Rewriting the value sends the caret to the end; keep it where the closer is typing.
    requestAnimationFrame(() => {
      const at = caretAfterDigits(value, digitsBefore)
      if (document.activeElement === input) input.setSelectionRange(at, at)
    })
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
    if (field === 'cvv') return '•'.repeat(digits.length)
    return maskTail(digits, { grouped: field === 'account_number' })
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
    if (Object.values(found).some(Boolean)) {
      // The expiry isn't on screen while the card is locked, so say why the save stopped.
      if (cardLocked && found.expiry) {
        setBanner('The saved expiry has passed. Request to edit the card to change it.')
      }
      return
    }

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
      else setBanner(err instanceof Error ? err.message : 'Could not save the card. Please try again.')
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
        onChange={(e) => {
          if (name === 'account_number') typeAccountNumber(e.target)
          else
            update(
              name,
              name === 'expiry' ? formatExpiryInput(e.target.value, form.expiry) : e.target.value
            )
        }}
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
  const cardStatus =
    saved && !readOnly && cardEdit !== 'open' ? (
      <CardEditStatus cardEdit={cardEdit} onRequest={() => setRequesting(true)} />
    ) : null

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col rounded-xl border-hairline border-slate bg-white p-6"
    >
      <div className="flex items-baseline justify-between gap-4 border-b-hairline border-light-grey pb-4">
        <h2 className="text-lg font-medium leading-[120%] text-ink">Card & Payment</h2>
        {saved && (
          <p className="text-xs text-slate">Saved {formatDateTime(saved.updated_at)}</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {load.status === 'locked' && (
          <p className="text-sm leading-[150%] text-slate">
            Card unlocks after the transfer is accepted.
          </p>
        )}
        {load.status === 'loading' && (
          <p className="text-sm leading-[150%] text-slate">Loading the card…</p>
        )}
        {load.status === 'error' && <Alert>{load.message}</Alert>}

        {saved && (readOnly || !editing) && <SavedCart saved={saved} />}
        {readOnly && load.status === 'ready' && !saved && (
          <p className="text-sm leading-[150%] text-slate">No card was saved on this call.</p>
        )}
        {cardStatus}

        {showForm && (
          <>
            <fieldset className="flex flex-col gap-4" disabled={locked}>
              <legend className="mb-2 text-sm font-medium text-ink">Card</legend>
              {saved && cardLocked ? (
                <dl>
                  <CardRows saved={saved} />
                </dl>
              ) : (
                <>
                  {field(
                    'account_number',
                    'Account number',
                    saved ? REPLACE_HINT : 'Up to 19 digits.',
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
                </>
              )}
              <Input
                label="Policy number (optional)"
                value={form.policy_number}
                onChange={(e) => update('policy_number', e.target.value)}
                onBlur={() => leave('policy_number')}
                disabled={locked}
                error={Boolean(problems.policy_number)}
                helperText={problems.policy_number ?? 'Needed for the sale to be marked Paid.'}
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
      <div className={readOnly ? 'hidden' : 'mt-6 flex gap-3'}>
        {showForm ? (
          <>
            <Button
              key="save"
              type="submit"
              disabled={locked}
              isLoading={saving}
              loadingText="Saving…"
            >
              {saved && cardLocked ? 'Save' : 'Save Card'}
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
            {cardLocked ? 'Edit payment' : 'Edit card'}
          </Button>
        )}
      </div>

      {requesting && (
        <RequestEditDialog
          interactionId={interactionId}
          onClose={() => setRequesting(false)}
          onSent={(item) => {
            setRequesting(false)
            if (saved) {
              const next: CardEdit = item.status === 'approved' ? 'approved' : 'waiting'
              setLoad({ status: 'ready', saved: { ...saved, card_edit: next } })
            }
          }}
        />
      )}
    </form>
  )
}
