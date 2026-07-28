/**
 * Caller identity/authorization for Edge Functions.
 *
 * Verifies the JWT, then loads the caller's own protected profile row (role,
 * department, active state) with the service-role client — never trusting
 * `user_metadata` for authorization (`.agents/plan.md` sections 13–15). An inactive or
 * missing profile is rejected here, the same instant a disabled account's `is_active`
 * flip takes effect for RLS.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './errors.ts';

export interface AuthorizedCaller {
  userId: string;
  role: 'officer' | 'supervisor';
  /** The caller's single home department — a Supervisor's only department. */
  departmentId: string;
  /** All departments this caller may read/act in — a Supervisor's is always just [departmentId]. */
  departmentIds: string[];
}

/**
 * Service-role client, for the narrow set of things ordinary anon/authenticated access
 * cannot do: verifying an arbitrary caller's JWT and reading protected profile data
 * regardless of that caller's own RLS grants, and later performing the Cloudinary
 * Admin API calls / attachment writes that have no client-facing grant. Never expose
 * this client's key to the frontend bundle — it exists only inside Edge Functions.
 */
export function serviceRoleClient() {
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
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) {
    throw new HttpError(401, 'Invalid or expired session.');
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role, department_id, is_active')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileError) throw new HttpError(500, 'Failed to load caller profile.');
  if (!profile || !profile.is_active) {
    throw new HttpError(403, 'This account has no active profile.');
  }

  const { data: scope, error: scopeError } = await client
    .from('profile_department_scope')
    .select('department_id')
    .eq('profile_id', userData.user.id);
  if (scopeError) throw new HttpError(500, 'Failed to load caller department scope.');

  return {
    userId: userData.user.id,
    role: profile.role,
    departmentId: profile.department_id,
    departmentIds: (scope ?? []).map((row) => row.department_id),
  };
}
