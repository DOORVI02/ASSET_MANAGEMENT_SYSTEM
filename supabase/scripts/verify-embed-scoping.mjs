#!/usr/bin/env node
/**
 * Live regression check for a real bug found and fixed in `parts.ts`/`maintenance.ts`/
 * `repairs.ts`: their department-scoped list queries narrow with
 * `.in('machine.department_id', [...])` — a filter on an embedded (joined) resource's
 * column. The Phase 11 RLS smoke test (`verify-data-layer.mjs`) never exercised this —
 * it only filtered the `machines` table directly — and it turned out PostgREST
 * silently ignores a dot-filter on the *default* (left-join) embed: the filter parses
 * but never narrows results. The fix is `machine:machines!inner(...)` — `!inner` turns
 * the embed into a real join condition the filter can act on. This script proves the
 * fix stays in place: a caller scoped to two departments asking for just one gets just
 * one. (RLS itself already prevents cross-department leakage regardless — this is
 * about correctness of further narrowing within a caller's own multi-department scope,
 * not a security boundary.)
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node verify-embed-scoping.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.');
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
  const email = `phase11-embed-verify-${Date.now()}@example.test`;
  const password = `Aa1!${Math.random().toString(36).slice(2)}`;

  const { data: departments, error: deptError } = await admin
    .from('departments')
    .select('id, code')
    .in('code', ['COB', 'CHM']);
  if (deptError) throw deptError;
  const cob = departments.find((d) => d.code === 'COB');
  const chm = departments.find((d) => d.code === 'CHM');
  if (!cob || !chm) throw new Error('Seed departments COB/CHM not found.');

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  const userId = created.user.id;

  let machineCobId;
  let machineChmId;
  let partCobId;
  let partChmId;

  try {
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      name: 'Phase 11 Embed Verify',
      email,
      phone: '+91 90000 00000',
      role: 'officer',
      position: 'Maintenance Officer',
      department_id: cob.id,
    });
    if (profileError) throw profileError;

    // Scoped to BOTH departments — this is the multi-department case the plain
    // machines.ts smoke test never exercised.
    const { error: scopeError } = await admin.from('profile_department_scope').insert([
      { profile_id: userId, department_id: cob.id },
      { profile_id: userId, department_id: chm.id },
    ]);
    if (scopeError) throw scopeError;

    const { data: machineCob, error: machineCobError } = await admin
      .from('machines')
      .insert({
        code: `EMBED-COB-${Date.now()}`,
        name: 'Embed Verify COB Machine',
        department_id: cob.id,
        type: 'conveyor',
        manufacturer: 'Test',
        model: 'T1',
        location: 'Test bay',
        installation_date: '2026-01-01',
        next_maintenance_date: '2026-12-01',
        description: 'Embed scoping check',
      })
      .select('id')
      .single();
    if (machineCobError) throw machineCobError;
    machineCobId = machineCob.id;

    const { data: machineChm, error: machineChmError } = await admin
      .from('machines')
      .insert({
        code: `EMBED-CHM-${Date.now()}`,
        name: 'Embed Verify CHM Machine',
        department_id: chm.id,
        type: 'conveyor',
        manufacturer: 'Test',
        model: 'T1',
        location: 'Test bay',
        installation_date: '2026-01-01',
        next_maintenance_date: '2026-12-01',
        description: 'Embed scoping check',
      })
      .select('id')
      .single();
    if (machineChmError) throw machineChmError;
    machineChmId = machineChm.id;

    const { data: partCob, error: partCobError } = await admin
      .from('machine_parts')
      .insert({
        machine_id: machineCobId,
        part_code: 'EMBED-COB-PART',
        part_name: 'COB test part',
        category: 'Test',
        quantity: 1,
        unit: 'pcs',
        position_on_machine: 'N/A',
        fitted_date: '2026-01-01',
        notes: '',
      })
      .select('id')
      .single();
    if (partCobError) throw partCobError;
    partCobId = partCob.id;

    const { data: partChm, error: partChmError } = await admin
      .from('machine_parts')
      .insert({
        machine_id: machineChmId,
        part_code: 'EMBED-CHM-PART',
        part_name: 'CHM test part',
        category: 'Test',
        quantity: 1,
        unit: 'pcs',
        position_on_machine: 'N/A',
        fitted_date: '2026-01-01',
        notes: '',
      })
      .select('id')
      .single();
    if (partChmError) throw partChmError;
    partChmId = partChm.id;

    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });

    // Sanity: with no department filter (just RLS), the caller sees parts from BOTH
    // departments they're scoped to.
    const { data: bothScopes, error: bothScopesError } = await client
      .from('machine_parts')
      .select('id, part_code, machine:machines(id, code, name, department_id, is_archived)')
      .in('id', [partCobId, partChmId]);
    if (bothScopesError) throw bothScopesError;
    check(
      'RLS alone (no department filter) exposes parts from both scoped departments',
      bothScopes.length === 2,
      `got ${bothScopes.length} rows`,
    );

    // parts.ts's actual pattern: `machine:machines!inner(...)` plus
    // `.in('machine.department_id', [departmentId])`, narrowing to just COB even
    // though the caller is scoped to both COB and CHM.
    const { data: cobOnly, error: cobOnlyError } = await client
      .from('machine_parts')
      .select('id, part_code, machine:machines!inner(id, code, name, department_id, is_archived)')
      .in('id', [partCobId, partChmId])
      .in('machine.department_id', [cob.id]);
    if (cobOnlyError) throw cobOnlyError;
    check(
      "parts.ts's embed-filter pattern (`machines!inner` + `.in('machine.department_id', [...])`) narrows to the requested department",
      cobOnly.length === 1 && cobOnly[0].id === partCobId,
      `got ${JSON.stringify(cobOnly.map((r) => r.part_code))}`,
    );
  } finally {
    if (partCobId) await admin.from('machine_parts').delete().eq('id', partCobId);
    if (partChmId) await admin.from('machine_parts').delete().eq('id', partChmId);
    if (machineCobId) await admin.from('machines').delete().eq('id', machineCobId);
    if (machineChmId) await admin.from('machines').delete().eq('id', machineChmId);
    await admin.from('profile_department_scope').delete().eq('profile_id', userId);
    await admin.from('profiles').update({ is_active: false }).eq('id', userId);
    await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Verification failed:', error.message ?? error);
  process.exit(1);
});
