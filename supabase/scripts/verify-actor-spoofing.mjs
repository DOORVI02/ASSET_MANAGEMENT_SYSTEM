#!/usr/bin/env node
/**
 * Live check for a Phase 10 gap carried over as "not yet attempted": actor spoofing.
 * `part_replacements_insert`'s RLS policy requires `performed_by = auth.uid()` — a
 * caller must name themself as the actor, never an arbitrary other profile. This
 * script proves it by attempting to record a replacement with `performed_by` set to a
 * *different* real profile's id, confirming RLS rejects it, then confirming the same
 * caller recording themself as the actor succeeds.
 *
 * (A second check — whether public self-signup accounts, live given `disable_signup`
 * still being `false`, can act as a real user — was also attempted here but had to be
 * dropped: `supabase.auth.signUp()` against a `@example.test` address is rejected by
 * GoTrue's email validation, the same domain-validation limitation already documented
 * in `supabase/scripts/README.md` for `inviteUserByEmail`. Testing it properly needs a
 * real deliverable domain, which this environment deliberately does not guess at — see
 * `.agents/phases.md` Phase 10 for the disposition of that gap.)
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node verify-actor-spoofing.mjs
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
  const email = `phase10-spoof-verify-${Date.now()}@example.test`;
  const password = `Aa1!${Math.random().toString(36).slice(2)}`;

  const { data: cobDept, error: deptError } = await admin
    .from('departments')
    .select('id')
    .eq('code', 'COB')
    .single();
  if (deptError) throw deptError;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  const userId = created.user.id;

  // A second, real profile to try spoofing `performed_by` as — a real row so any
  // rejection is unambiguously the `performed_by = auth.uid()` RLS check, not a
  // foreign-key violation on a nonexistent id.
  const impersonatedEmail = `phase10-spoof-target-${Date.now()}@example.test`;
  const { data: impersonatedCreated, error: impersonatedCreateError } = await admin.auth.admin.createUser({
    email: impersonatedEmail,
    password: `Aa1!${Math.random().toString(36).slice(2)}`,
    email_confirm: true,
  });
  if (impersonatedCreateError) throw impersonatedCreateError;
  const impersonatedId = impersonatedCreated.user.id;

  let partId;
  let machineId;
  try {
    const { error: profileError } = await admin.from('profiles').insert([
      {
        id: userId,
        name: 'Phase 10 Spoof Verify',
        email,
        phone: '+91 90000 00000',
        role: 'officer',
        position: 'Maintenance Officer',
        department_id: cobDept.id,
      },
      {
        id: impersonatedId,
        name: 'Phase 10 Spoof Target',
        email: impersonatedEmail,
        phone: '+91 90000 00000',
        role: 'officer',
        position: 'Maintenance Officer',
        department_id: cobDept.id,
      },
    ]);
    if (profileError) throw profileError;

    const { error: scopeError } = await admin
      .from('profile_department_scope')
      .insert({ profile_id: userId, department_id: cobDept.id });
    if (scopeError) throw scopeError;

    const { data: machine, error: machineError } = await admin
      .from('machines')
      .insert({
        code: `SPOOF-${Date.now()}`,
        name: 'Spoof Verify Machine',
        department_id: cobDept.id,
        type: 'conveyor',
        manufacturer: 'Test',
        model: 'T1',
        location: 'Test bay',
        installation_date: '2026-01-01',
        next_maintenance_date: '2026-12-01',
        description: 'Actor-spoofing check',
      })
      .select('id')
      .single();
    if (machineError) throw machineError;
    machineId = machine.id;

    const { data: part, error: partError } = await admin
      .from('machine_parts')
      .insert({
        machine_id: machineId,
        part_code: 'SPOOF-PART',
        part_name: 'Spoof test part',
        category: 'Test',
        quantity: 1,
        unit: 'pcs',
        position_on_machine: 'N/A',
        fitted_date: '2026-01-01',
        notes: '',
      })
      .select('id')
      .single();
    if (partError) throw partError;
    partId = part.id;

    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });

    const { error: spoofError } = await client.from('part_replacements').insert({
      part_id: partId,
      replaced_on: '2026-01-01',
      reason: 'Spoofing attempt',
      performed_by: impersonatedId, // NOT this caller's own uid
    });
    check(
      'recording a replacement with performed_by set to a different profile is rejected',
      !!spoofError,
      spoofError ? spoofError.message : 'insert unexpectedly succeeded',
    );

    const { error: honestError } = await client.from('part_replacements').insert({
      part_id: partId,
      replaced_on: '2026-01-01',
      reason: 'Honest replacement',
      performed_by: userId, // the caller's own uid
    });
    check('recording a replacement with performed_by set to the real caller succeeds', !honestError);
  } finally {
    if (partId) await admin.from('part_replacements').delete().eq('part_id', partId);
    if (partId) await admin.from('machine_parts').delete().eq('id', partId);
    if (machineId) await admin.from('audit_logs').delete().eq('entity_id', machineId);
    if (machineId) await admin.from('machines').delete().eq('id', machineId);
    await admin.from('profile_department_scope').delete().eq('profile_id', userId);
    await admin.from('profiles').update({ is_active: false }).eq('id', userId);
    await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
    await admin.from('profiles').update({ is_active: false }).eq('id', impersonatedId);
    await admin.auth.admin.updateUserById(impersonatedId, { ban_duration: '876000h' });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Verification failed:', error.message ?? error);
  process.exit(1);
});
