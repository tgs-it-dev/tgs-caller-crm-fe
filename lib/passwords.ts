// The API's ceiling is bcrypt's, and it counts bytes rather than characters:
// one emoji is four of them, so a passphrase can pass a length check here and
// still be refused there.
export const MAX_PASSWORD_BYTES = 72

/** Why the API would refuse this as a new password, or null when it would take it. */
export function newPasswordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return 'That password is too long. Please choose a shorter one.'
  }
  return null
}
