/**
 * Real Supabase Auth, replacing the preview `mock-auth.ts`.
 *
 * Two rules shape everything here:
 *
 * 1. **A session is not access.** Supabase Auth will happily issue a valid JWT to any
 *    identity in `auth.users`, including one with no `profiles` row (the project has such
 *    an identity, left over from an SMTP delivery test) or one whose profile has been
 *    deactivated during offboarding. Neither may enter the app. `loadSignedInProfile`
 *    therefore treats "authenticated" and "authorized" as separate questions and answers
 *    the second one against `profiles`, not against the token.
 *
 * 2. **Scope comes from the server.** The preview resolved a user's departments by
 *    matching `UserProfile.departmentScope` (names) against the department list in the
 *    browser. Here the department names are read back through RLS, so what the UI believes
 *    the user can see is derived from what the database will actually return rather than
 *    from a client-side string comparison that could disagree with it.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import type { Role, UserProfile } from '@/lib/types';

/** Why a signed-in identity was refused entry, for a message the user can act on. */
export type AccessDenialReason = 'no_profile' | 'deactivated';

export class AccessDeniedError extends Error {
  readonly reason: AccessDenialReason;

  constructor(reason: AccessDenialReason) {
    super(
      reason === 'no_profile'
        ? 'This account is not set up for the asset register. Ask an officer to provision it.'
        : 'This account has been deactivated. Contact an officer if you still need access.',
    );
    this.name = 'AccessDeniedError';
    this.reason = reason;
  }
}

/**
 * "R. Kumar" -> "RK". First and last initials, so a middle name doesn't push the badge to
 * three characters. Falls back to the first character of the email's local part, because
 * the header renders this unconditionally and a blank badge reads as a broken avatar.
 */
export function initialsFor(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return (email[0] ?? '?').toUpperCase();
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  // A failed sign-out still has to clear the client-side session, or the user stays
  // "signed in" in a UI that has already decided they are not. supabase-js clears local
  // storage before the network call, so the local half has happened by the time this
  // resolves; the error is worth surfacing but not worth blocking on.
  if (error && error.status !== 401 && error.status !== 403) throw error;
}

/**
 * Loads the signed-in user's profile, or `null` if there is no session at all.
 *
 * Throws `AccessDeniedError` when there *is* a session but it must not be honoured.
 * Callers are expected to sign out in that case — leaving the session in place would
 * leave the app looping between "authenticated" and "not allowed in".
 */
export async function loadSignedInProfile(): Promise<UserProfile | null> {
  const client = getSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) {
    // A missing/expired session is not an error condition, it is a signed-out user.
    if (userError.status === 401 || userError.status === 403) return null;
    throw userError;
  }
  if (!user) return null;

  const [profileResult, scopeResult] = await Promise.all([
    client
      .from('profiles')
      .select('id, name, email, phone, role, position, is_active, department_id')
      .eq('id', user.id)
      .maybeSingle(),
    client
      .from('profile_department_scope')
      .select('department_id, departments!inner(name)')
      .eq('profile_id', user.id),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (scopeResult.error) throw scopeResult.error;

  const profile = profileResult.data;
  if (!profile) throw new AccessDeniedError('no_profile');
  if (!profile.is_active) throw new AccessDeniedError('deactivated');

  const scopeNames = (scopeResult.data ?? []).map((row) => row.departments.name);
  const homeScopeRow = (scopeResult.data ?? []).find(
    (row) => row.department_id === profile.department_id,
  );

  // The home department name normally comes free from the scope rows, since a profile's
  // own department is always in its scope. It is fetched separately only if that
  // invariant is somehow broken, so the profile screen doesn't render a blank department.
  const departmentName = homeScopeRow
    ? homeScopeRow.departments.name
    : await fetchDepartmentName(client, profile.department_id);

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role as Role,
    department: departmentName,
    departmentScope: scopeNames,
    position: profile.position,
    status: profile.is_active ? 'active' : 'inactive',
    // `auth.users.last_sign_in_at` is Auth's own record, so it is not duplicated into
    // `profiles` (migration 20260727000002 says so explicitly). It is the *current*
    // sign-in once a session exists, which is what the profile screen labels it as.
    lastLogin: user.last_sign_in_at ?? new Date().toISOString(),
    avatarInitials: initialsFor(profile.name, profile.email),
  };
}

async function fetchDepartmentName(
  client: ReturnType<typeof getSupabaseClient>,
  departmentId: string,
): Promise<string> {
  const { data, error } = await client
    .from('departments')
    .select('name')
    .eq('id', departmentId)
    .maybeSingle();
  if (error) throw error;
  return data?.name ?? 'Unassigned';
}

/**
 * Sends the password recovery email.
 *
 * `redirectTo` must be an exact match for an entry in `supabase/config.toml`'s
 * `auth.additional_redirect_urls` (or `site_url`), or Supabase rejects it and falls back to
 * `site_url` — which is how a recovery link ends up pointing at the wrong host. It is built
 * from `window.location.origin` so a preview deployment recovers to itself rather than to
 * production, provided that origin is on the allow-list.
 *
 * Deliberately does not report whether the address exists: Supabase returns success either
 * way, and the calling screen shows the same confirmation regardless. Anything else turns
 * this form into a roster oracle.
 */
export async function requestPasswordRecovery(email: string, resetPath: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}${resetPath}`,
  });
  if (error) throw error;
}

/**
 * Sets a new password for the recovery session the link established.
 *
 * Authorization is the session itself — that is the whole point of the emailed link, and
 * why this screen is reachable without signing in. The session is ended afterwards by the
 * caller so the new password has to be used at least once, which is also the only proof
 * available that it was actually stored.
 */
export async function updatePassword(password: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

/** Whether a recovery session exists right now, i.e. whether the emailed link worked. */
export async function hasRecoverySession(): Promise<boolean> {
  const client = getSupabaseClient();
  const {
    data: { session },
  } = await client.auth.getSession();
  return Boolean(session);
}

/** Distinguishes Supabase's generic sign-in failure from anything else worth reporting. */
export function isInvalidCredentials(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Partial<PostgrestError> & { status?: number; code?: string };
  return candidate.status === 400 || candidate.code === 'invalid_credentials';
}
