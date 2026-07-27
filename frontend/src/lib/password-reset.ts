/**
 * Recovery-token handling for the `/reset-password` screen.
 *
 * This is a **preview** implementation. Supabase issues the real recovery token in the
 * URL fragment during the backend phase, and Supabase — not this module — decides
 * whether it is valid. What is real here, and what the backend phase must preserve, is
 * the set of states the screen has to render: missing, malformed, expired, already
 * used, and valid. Those were confirmed on 2026-07-26.
 *
 * The preview token shape is `<id>.<expiryEpochSeconds>.<nonce>` so each state can be
 * reached deterministically from a URL without a server.
 */

/** localStorage key recording nonces that have already completed a reset. */
export const RESET_CONSUMED_STORAGE_KEY = 'sail_reset_consumed';

export type ResetTokenState = 'missing' | 'malformed' | 'expired' | 'used' | 'valid';

export interface ParsedResetToken {
  id: string;
  expiresAt: number;
  nonce: string;
}

const TOKEN_PATTERN = /^([A-Za-z0-9_-]{3,64})\.(\d{9,13})\.([A-Za-z0-9_-]{6,64})$/;

export function parseResetToken(token: string | null | undefined): ParsedResetToken | null {
  if (!token) return null;
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return null;

  const expiresAt = Number(match[2]);
  if (!Number.isFinite(expiresAt)) return null;

  return { id: match[1], expiresAt, nonce: match[3] };
}

function readConsumed(): string[] {
  try {
    const raw = window.localStorage.getItem(RESET_CONSUMED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function isResetTokenConsumed(nonce: string): boolean {
  return readConsumed().includes(nonce);
}

/** Records a nonce so the same recovery link cannot be replayed. */
export function consumeResetToken(nonce: string): void {
  try {
    const next = [...new Set([...readConsumed(), nonce])].slice(-50);
    window.localStorage.setItem(RESET_CONSUMED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort: the current reset still completes.
  }
}

export function classifyResetToken(
  token: string | null | undefined,
  now: number = Date.now(),
): ResetTokenState {
  if (!token) return 'missing';

  const parsed = parseResetToken(token);
  if (!parsed) return 'malformed';

  // Checked before expiry so a link that was used and has since lapsed still reports
  // the more specific, more actionable reason.
  if (isResetTokenConsumed(parsed.nonce)) return 'used';
  if (parsed.expiresAt * 1000 <= now) return 'expired';

  return 'valid';
}

/**
 * Password rules for the preview.
 *
 * The production policy is still unconfirmed — `.agents/flow.md` section 16 lists
 * password policy alongside SMTP ownership and session lifetime. These rules are a
 * reasonable working default, not a settled contract.
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

/** Builds a preview recovery link so each token state is reachable during review. */
export function previewResetLink(state: 'valid' | 'expired', nonce = 'previewnonce'): string {
  const hour = 60 * 60;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiry = state === 'valid' ? nowSeconds + hour : nowSeconds - hour;
  return `/reset-password?token=officer.${expiry}.${nonce}`;
}
