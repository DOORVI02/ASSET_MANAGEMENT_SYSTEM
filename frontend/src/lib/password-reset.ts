/**
 * Password policy and recovery-link classification for the `/reset-password` screen.
 *
 * This replaced a preview implementation on 2026-07-29. The preview invented its own token
 * shape (`<id>.<expiry>.<nonce>`) and tracked spent links in `localStorage`, because there
 * was no server to issue or validate anything. None of that survives: Supabase issues the
 * real recovery token, Supabase decides whether it is valid, and Supabase enforces single
 * use. The browser-side "already used" list was never a security control — it existed so
 * each screen state could be reached during review.
 *
 * What did survive is the set of states the screen has to render, which is the part the
 * preview got right: no link, an unusable link, an expired-or-already-spent link, and a
 * valid one. The mapping onto Supabase's actual behaviour is below.
 */

/**
 * Supabase's recovery link lands on this app with either:
 *
 * - `#access_token=...&refresh_token=...&type=recovery` (implicit flow), which supabase-js
 *   consumes automatically and turns into a session, or
 * - `?code=...` (PKCE flow), likewise exchanged automatically, or
 * - `#error=access_denied&error_code=otp_expired&...` when the link has expired or has
 *   already been spent.
 *
 * So the screen never parses a token itself. It asks two questions: does the URL carry a
 * recovery attempt at all, and did that attempt already fail?
 */
export type RecoveryLinkState = 'missing' | 'invalid' | 'expired' | 'pending';

export interface RecoveryLinkLocation {
  /** `window.location.hash`, with or without the leading `#`. */
  hash: string;
  /** `window.location.search`, with or without the leading `?`. */
  search: string;
}

export function classifyRecoveryLink({ hash, search }: RecoveryLinkLocation): RecoveryLinkState {
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(search.replace(/^\?/, ''));

  // Errors arrive in the fragment for the implicit flow and in the query string for PKCE,
  // so both are checked rather than assuming which flow the project is on — that is a
  // Supabase-side setting this screen shouldn't depend on.
  const errorCode =
    hashParams.get('error_code') ??
    searchParams.get('error_code') ??
    hashParams.get('error') ??
    searchParams.get('error');

  if (errorCode) {
    // Supabase reports an expired link and an already-spent link with the same code —
    // recovery tokens are single use, so a second click is indistinguishable from a lapse.
    // The screen's copy therefore has to cover both rather than assert one.
    return errorCode === 'otp_expired' ? 'expired' : 'invalid';
  }

  const hasRecoveryAttempt =
    hashParams.has('access_token') ||
    searchParams.has('code') ||
    hashParams.get('type') === 'recovery';

  // `pending`, not `valid`: the URL carries a recovery attempt, but whether it produced a
  // usable session is Supabase's answer to give, not this function's. The screen waits for
  // the session before offering the form.
  return hasRecoveryAttempt ? 'pending' : 'missing';
}

/**
 * Password rules.
 *
 * These must stay in step with `supabase/config.toml`'s `[auth] minimum_password_length`
 * and `password_requirements`, which is what actually enforces them — a rule checked only
 * in the browser is a suggestion. They were aligned on 2026-07-29; before that the server
 * accepted 6 characters with no character-class requirement while this file claimed 10
 * with three classes, so the stricter half was decorative.
 */
export const PASSWORD_MIN_LENGTH = 10;

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return 'Include both an uppercase and a lowercase letter.';
  }
  if (!/\d/.test(password)) {
    return 'Include at least one number.';
  }
  if (password !== confirmation) {
    return 'Both passwords must match.';
  }
  return null;
}
