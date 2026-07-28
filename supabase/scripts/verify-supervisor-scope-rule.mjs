#!/usr/bin/env node
/**
 * Live checks for the supervisor single-department rule (flow.md section 6.2) and the two
 * bypasses migration 20260728000017 closed, found 2026-07-29:
 *
 *   1. A multi-row `insert` into `profile_department_scope` for a supervisor. The original
 *      `before insert` trigger counted only rows visible under the statement's snapshot,
 *      which excludes the statement's own earlier rows — so a two-row batch passed with
 *      both invocations counting zero.
 *   2. `update profiles set role = 'supervisor'` on a profile that already holds several
 *      departments. The original trigger watched only the scope table, so this reached the
 *      forbidden state without touching the guarded table at all.
 *
 * Both are checked against the real database with the service role, i.e. the most
 * privileged caller — a rule that only holds for under-privileged callers is not a data
 * integrity rule. Officers must still be allowed multiple departments, which is checked
 * too: a fix that clamped everyone to one department would "pass" every negative test.
 *
 * Throwaway `@example.test` accounts only. Cleanup deactivates and bans rather than
 * deletes, because `profiles` is referenced with `on delete restrict` from the audit
 * trail (see `scripts/README.md`).
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node verify-supervisor-scope-rule.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`);
}

const created = [];

async function makeProfile(role, departmentId, label) {
  const email = `scope-rule-${label}-${Date.now()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Verify-${Date.now()}-Aa1`,
    email_confirm: true,
  });
  if (error) throw error;
  created.push(data.user.id);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    name: `Scope Rule ${label}`,
    email,
    phone: '',
    role,
    position: 'Verification',
    department_id: departmentId,
  });
  if (profileError) throw profileError;
  return data.user.id;
}

async function main() {
  const { data: departments, error: deptError } = await admin
    .from('departments')
    .select('id, code')
    .in('code', ['SP3', 'CHM', 'PM'])
    .order('code');
  if (deptError) throw deptError;
  if (departments.length < 3) throw new Error('Expected SP3, CHM and PM to exist.');
  const [a, b, c] = departments;

  // 1. The batch-insert bypass.
  const supervisor = await makeProfile('supervisor', a.id, 'batch');
  const batch = await admin
    .from('profile_department_scope')
    .insert([
      { profile_id: supervisor, department_id: a.id },
      { profile_id: supervisor, department_id: b.id },
    ]);
  check(
    'a two-row batch insert for a supervisor is rejected',
    batch.error !== null,
    batch.error ? batch.error.message.slice(0, 90) : 'insert succeeded — the bypass is open',
  );

  const { count: leftover } = await admin
    .from('profile_department_scope')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', supervisor);
  check(
    'the rejected batch left no partial scope behind',
    leftover === 0,
    `${leftover} row(s) present`,
  );

  // 2. A supervisor's one legitimate row still works, and a second one does not.
  const single = await admin
    .from('profile_department_scope')
    .insert({ profile_id: supervisor, department_id: a.id });
  check('a supervisor may still be given exactly one department', single.error === null,
    single.error?.message);

  const second = await admin
    .from('profile_department_scope')
    .insert({ profile_id: supervisor, department_id: b.id });
  check('a second department for the same supervisor is rejected', second.error !== null,
    second.error ? second.error.message.slice(0, 90) : 'insert succeeded');

  // 3. Officers must remain multi-department — the rule is role-specific, not global.
  const officer = await makeProfile('officer', a.id, 'officer');
  const officerBatch = await admin.from('profile_department_scope').insert([
    { profile_id: officer, department_id: a.id },
    { profile_id: officer, department_id: b.id },
    { profile_id: officer, department_id: c.id },
  ]);
  check('an officer may still hold several departments', officerBatch.error === null,
    officerBatch.error?.message);

  // 4. The role-change bypass: promote that multi-department officer to supervisor.
  const promote = await admin.from('profiles').update({ role: 'supervisor' }).eq('id', officer);
  check(
    'promoting a multi-department officer to supervisor is rejected',
    promote.error !== null,
    promote.error ? promote.error.message.slice(0, 110) : 'update succeeded — the bypass is open',
  );

  const { data: stillOfficer } = await admin
    .from('profiles')
    .select('role')
    .eq('id', officer)
    .single();
  check(
    'the rejected promotion left the role unchanged',
    stillOfficer?.role === 'officer',
    `role is ${stillOfficer?.role}`,
  );
}

async function cleanup() {
  for (const id of created) {
    await admin.from('profile_department_scope').delete().eq('profile_id', id);
    await admin.from('profiles').update({ is_active: false }).eq('id', id);
    await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
  }
  console.log(`Cleaned up ${created.length} throwaway account(s) (deactivated and banned).`);
}

main()
  .catch((error) => {
    console.error('Verification error:', error.message ?? error);
    results.push({ name: 'script completed', ok: false });
  })
  .finally(async () => {
    await cleanup();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
    process.exit(failed.length === 0 ? 0 : 1);
  });
