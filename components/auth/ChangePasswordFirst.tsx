'use client'

import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'
import { useCurrentUser } from '@/components/auth/CurrentUserProvider'

/**
 * Shown in place of any page while the password is one somebody else chose. The
 * API refuses everything else until it is changed, so no desk loads behind it.
 */
export function ChangePasswordFirst() {
  const { refresh, signOut } = useCurrentUser()
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-12">
      <section className="w-full max-w-md rounded-xl border-hairline border-slate bg-white p-6">
        <h1 className="text-lg font-semibold leading-[120%] text-ink">Choose your own password</h1>
        <p className="mt-1 text-sm leading-[150%] text-body-text">
          Your password was set by an admin. Choose a new one before you start.
        </p>
        <div className="mt-5">
          <ChangePasswordForm
            submitLabel="Save and go"
            onChanged={() => void refresh()}
            aside={
              <button
                type="button"
                onClick={signOut}
                className="text-sm font-medium text-navy underline hover:text-black"
              >
                Sign out
              </button>
            }
          />
        </div>
      </section>
    </main>
  )
}
