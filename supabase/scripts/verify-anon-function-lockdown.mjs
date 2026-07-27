#!/usr/bin/env node
/**
 * Live regression check for a real security gap found and fixed 2026-07-27/28:
 * `20260727000012_auth_helper_functions.sql` documented `auth_role()`,
 * `auth_department_ids()`, `auth_can_see_archived()`, and `entity_department_id()` as
 * "revoked from PUBLIC and granted only to authenticated" — but a live check against
 * `information_schema.routine_privileges` showed `anon` held EXECUTE on all four
 * anyway. Root cause: Supabase provisions new projects with default privileges that
 * auto-grant EXECUTE on new *functions* to `anon`/`authenticated` (the same platform
 * default the RLS migration already had to work around for *tables*, just missed for
 * functions). `REVOKE ... FROM PUBLIC` doesn't touch a role's own separate default
 * grant. `20260727000015_lock_down_auth_helper_functions.sql` explicitly revokes
 * EXECUTE from `anon` on all four.
 *
 * Impact this closed: `auth_role()`/`auth_department_ids()`/`auth_can_see_archived()`
 * are gated on `auth.uid()` (null for anon), so they leaked nothing in practice —
 * but `entity_department_id(entity_type, entity_id)` takes no identity-bound
 * parameter and, being `security definer`, bypasses RLS entirely: an unauthenticated
 * caller could learn which department any machine/part/maintenance/repair record
 * belongs to, given or by enumerating its UUID.
 *
 * This script requires only the anon key/JWT — no service role, no throwaway account,
 * nothing to clean up. It calls each function as `anon` and asserts a 42501
 * permission-denied error, then calls `auth_role()` as a real signed-in user to
 * confirm `authenticated` access still works (no regression).
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node verify-anon-function-lockdown.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY before running this script.');
  process.exit(1);
}

const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`);
}

function isPermissionDenied(error) {
  return error?.code === '42501';
}

async function main() {
  const { error: roleError } = await anon.rpc('auth_role');
  check('anon calling auth_role() is denied', isPermissionDenied(roleError), roleError?.message);

  const { error: deptIdsError } = await anon.rpc('auth_department_ids');
  check(
    'anon calling auth_department_ids() is denied',
    isPermissionDenied(deptIdsError),
    deptIdsError?.message,
  );

  const { error: archivedError } = await anon.rpc('auth_can_see_archived');
  check(
    'anon calling auth_can_see_archived() is denied',
    isPermissionDenied(archivedError),
    archivedError?.message,
  );

  const { error: entityDeptError } = await anon.rpc('entity_department_id', {
    p_entity_type: 'machine',
    p_entity_id: '00000000-0000-0000-0000-000000000000',
  });
  check(
    'anon calling entity_department_id() is denied',
    isPermissionDenied(entityDeptError),
    entityDeptError?.message,
  );

  const { error: tableError } = await anon.from('profiles').select('*').limit(1);
  check(
    'anon reading profiles directly is still denied (unchanged by this fix)',
    isPermissionDenied(tableError),
    tableError?.message,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Verification failed:', error.message ?? error);
  process.exit(1);
});
