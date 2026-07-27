#!/usr/bin/env node
/**
 * Live verification of the Phase 11 data layer (`frontend/src/lib/supabase/*.ts`)
 * against the real hosted project and real RLS — following the same safe-testing
 * pattern established in Phase 10: a throwaway `@example.test` Auth identity created
 * via the service role, a real sign-in to get a genuine JWT, real PostgREST queries
 * under that JWT (never a service-role bypass for the assertions themselves), and full
 * cleanup at the end.
 *
 * This script does not import the TypeScript modules directly (they use the `@/`
 * path alias and run through Vite, not plain Node) — it re-implements the same
 * queries inline with `@supabase/supabase-js`, so what's being verified is the exact
 * request shape (`.select()`/`.eq()`/`.in()`/embeds) those modules build.
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node verify-data-layer.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    'Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY before running this script.',
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  const email = `phase11-verify-${Date.now()}@example.test`;
  const password = `Aa1!${Math.random().toString(36).slice(2)}`;

  const { data: departments, error: deptError } = await admin
    .from('departments')
    .select('id, code')
    .in('code', ['COB', 'CC']);
  if (deptError) throw deptError;
  const cob = departments.find((d) => d.code === 'COB');
  const cc = departments.find((d) => d.code === 'CC');
  if (!cob || !cc) throw new Error('Seed departments COB/CC not found — run supabase/seed.sql first.');

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  const userId = created.user.id;

  let machineId;
  try {
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      name: 'Phase 11 Verify',
      email,
      phone: '+91 90000 00000',
      role: 'officer',
      position: 'Maintenance Officer',
      department_id: cob.id,
    });
    if (profileError) throw profileError;

    const { error: scopeError } = await admin
      .from('profile_department_scope')
      .insert({ profile_id: userId, department_id: cob.id });
    if (scopeError) throw scopeError;

    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });

    // 1. Department scoping: the caller should see only COB, never CC.
    const { data: visibleDepartments, error: listDeptError } = await client
      .from('departments')
      .select('id, code');
    if (listDeptError) throw listDeptError;
    check(
      'departments read is scoped to the caller\'s single department',
      visibleDepartments.length === 1 && visibleDepartments[0].code === 'COB',
      `got ${JSON.stringify(visibleDepartments.map((d) => d.code))}`,
    );

    // 2. Officer can create a machine in their own department (mirrors machines.ts createMachine).
    const code = `VERIFY-${Date.now()}`;
    const { data: createdMachine, error: createMachineError } = await client
      .from('machines')
      .insert({
        code,
        name: 'Verification Conveyor',
        department_id: cob.id,
        type: 'conveyor',
        manufacturer: 'Test',
        model: 'T1',
        location: 'Test bay',
        installation_date: '2026-01-01',
        next_maintenance_date: '2026-12-01',
        description: 'Created by verify-data-layer.mjs',
      })
      .select('id')
      .single();
    if (createMachineError) throw createMachineError;
    machineId = createdMachine.id;
    check('officer can create a machine in their own department', true);

    // 3. That machine is now visible via machines_with_derived with derived fields populated.
    const { data: derived, error: derivedError } = await client
      .from('machines_with_derived')
      .select('*')
      .eq('id', machineId)
      .maybeSingle();
    if (derivedError) throw derivedError;
    check(
      'machines_with_derived exposes the new row with a department_name and due_state',
      derived?.department_name === 'Coke Ovens' && !!derived?.due_state,
      `got department_name=${derived?.department_name}, due_state=${derived?.due_state}`,
    );

    // 4. Attempting to create a machine in an out-of-scope department must fail (RLS denies it).
    const { error: crossDeptError } = await client.from('machines').insert({
      code: `VERIFY-CC-${Date.now()}`,
      name: 'Out of scope machine',
      department_id: cc.id,
      type: 'pump',
      manufacturer: 'Test',
      model: 'T1',
      location: 'Test bay',
      installation_date: '2026-01-01',
      next_maintenance_date: '2026-12-01',
      description: 'Should be rejected by RLS',
    });
    check(
      'inserting a machine into an out-of-scope department is rejected',
      !!crossDeptError,
      crossDeptError ? crossDeptError.message : 'insert unexpectedly succeeded',
    );

    // 5. department_summary reflects the new machine.
    const { data: summary, error: summaryError } = await client
      .from('department_summary')
      .select('*')
      .eq('department_id', cob.id)
      .maybeSingle();
    if (summaryError) throw summaryError;
    check('department_summary counts the newly created machine', (summary?.total ?? 0) >= 1);

    // 6. Archive then restore the machine (mirrors machines.ts archiveMachine/restoreMachine).
    const { error: archiveError } = await client
      .from('machines')
      .update({ is_archived: true, status: 'retired' })
      .eq('id', machineId)
      .eq('is_archived', false);
    if (archiveError) throw archiveError;
    const { data: afterArchive, error: afterArchiveError } = await client
      .from('machines')
      .select('is_archived, status')
      .eq('id', machineId)
      .maybeSingle();
    if (afterArchiveError) throw afterArchiveError;
    check(
      'archiving sets is_archived and status together',
      afterArchive?.is_archived === true && afterArchive?.status === 'retired',
    );

    const { error: restoreError } = await client
      .from('machines')
      .update({ is_archived: false, status: 'inactive' })
      .eq('id', machineId)
      .eq('is_archived', true);
    if (restoreError) throw restoreError;
    const { data: afterRestore, error: afterRestoreError } = await client
      .from('machines')
      .select('is_archived, status')
      .eq('id', machineId)
      .maybeSingle();
    if (afterRestoreError) throw afterRestoreError;
    check(
      'restoring clears is_archived and sets status back to inactive',
      afterRestore?.is_archived === false && afterRestore?.status === 'inactive',
    );

    // 7. Reading machines in the out-of-scope department returns nothing (RLS filters silently).
    const { data: ccMachines, error: ccMachinesError } = await client
      .from('machines_with_derived')
      .select('id')
      .eq('department_id', cc.id);
    if (ccMachinesError) throw ccMachinesError;
    check('reading machines in an out-of-scope department returns an empty result', ccMachines.length === 0);
  } finally {
    // The archive/restore steps above generated real audit_logs rows for this actor,
    // and audit_logs is genuinely append-only (a trigger rejects DELETE outright, even
    // for the service role — that's the schema working as designed, not a bug to route
    // around with raw DDL). So the test profile can never be hard-deleted once it has
    // acted. Deactivate it instead, the same soft-delete convention this product uses
    // everywhere else (archived machines/parts, never hard deletes): drop its
    // department scope (already done — zero access from here on), mark the profile
    // inactive, and ban the Auth identity so it can never sign in again. The machine it
    // created has no such restriction (nothing FKs to machines.id with RESTRICT) and is
    // hard-deleted as before.
    if (machineId) {
      const { error } = await admin.from('machines').delete().eq('id', machineId);
      if (error) console.error('Cleanup warning: failed to delete test machine:', error.message);
    }
    const { error: scopeCleanupError } = await admin
      .from('profile_department_scope')
      .delete()
      .eq('profile_id', userId);
    if (scopeCleanupError) console.error('Cleanup warning:', scopeCleanupError.message);
    const { error: deactivateError } = await admin
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId);
    if (deactivateError) console.error('Cleanup warning:', deactivateError.message);
    const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
    if (banError) console.error('Cleanup warning:', banError.message);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Verification failed:', error.message ?? error);
  process.exit(1);
});
