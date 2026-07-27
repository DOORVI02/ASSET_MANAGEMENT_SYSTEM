/**
 * Caller identity/authorization for Edge Functions.
 *
 * This is a foundation-phase skeleton: `profiles` does not exist until the Phase 9
 * schema lands, so `getAuthorizedCaller` cannot be exercised yet. The shape is fixed
 * now so Phase 10/12 functions can depend on a stable interface — verifying the JWT,
 * then loading the caller's own protected profile row (role, department scope, active
 * state) with the service-role client, never trusting `user_metadata` for authorization
 * (`.agents/plan.md` sections 13–15).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './errors.ts';

export interface AuthorizedCaller {
  userId: string;
  // Populated once `profiles` exists (Phase 9/10). Left loose here rather than typed
  // against a table that is not yet migrated.
  profile: Record<string, unknown>;
}

/**
 * Service-role client, for the narrow set of things ordinary anon/authenticated access
 * cannot do: verifying an arbitrary caller's JWT and reading protected profile data
 * regardless of that caller's own RLS grants. Never expose this client's key to the
 * frontend bundle — it exists only inside Edge Functions.
 */
function serviceRoleClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new HttpError(500, 'Edge Function is missing its Supabase service configuration.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getAuthorizedCaller(req: Request): Promise<AuthorizedCaller> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing bearer token.');
  }
  const token = authHeader.slice('Bearer '.length);

  const client = serviceRoleClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, 'Invalid or expired session.');
  }

  // TODO(Phase 10): load `profiles` by `data.user.id` here, reject an inactive or
  // missing profile, and return its role/department/active fields instead of `{}`.
  return { userId: data.user.id, profile: {} };
}
