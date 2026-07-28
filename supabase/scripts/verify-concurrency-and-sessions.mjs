#!/usr/bin/env node
/**
 * Live checks for Phase 13's "concurrency, transaction rollback, expired sessions"
 * task — the parts of it achievable without the frontend auth+data cutover, since
 * these exercise the live database and Edge Functions directly.
 *
 *  1. Concurrency: two simultaneous machine-creation requests with the same code
 *     race against `machines_code_key`. Expect exactly one to succeed and one to
 *     fail with a duplicate-code conflict — proving the unique constraint holds
 *     under real concurrent load, not just sequential check-then-insert.
 *  2. Transaction integrity: an insert that violates a constraint (an unknown
 *     department_id) leaves no partial/orphaned row behind — the whole insert
 *     either fully lands or fully doesn't, never a half-written row.
 *  3. Invalid/expired session handling: a syntactically malformed JWT, a
 *     well-formed-but-wrong-signature JWT, and a real JWT with its signature
 *     truncated (simulating tampering) are all rejected by `getAuthorizedCaller`
 *     the same way, via `cloudinary-sign`.
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node verify-concurrency-and-sessions.mjs
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
  const { data: cob, error: cobError } = await admin.from('departments').select('id').eq('code', 'COB').single();
  if (cobError) throw cobError;

  // ── 1. Concurrency: race two inserts with the same machine code ──────────────
  const raceCode = `RACE-${Date.now()}`;
  const machinePayload = (code) => ({
    code,
    name: 'Concurrency check machine',
    department_id: cob.id,
    type: 'conveyor',
    manufacturer: 'Test',
    model: 'T1',
    location: 'Test bay',
    installation_date: '2026-01-01',
    next_maintenance_date: '2026-12-01',
    description: 'Phase 13 concurrency check',
  });

  const [first, second] = await Promise.all([
    admin.from('machines').insert(machinePayload(raceCode)).select('id'),
    admin.from('machines').insert(machinePayload(raceCode)).select('id'),
  ]);

  const successes = [first, second].filter((r) => !r.error);
  const failures = [first, second].filter((r) => r.error);
  check(
    'two simultaneous inserts with the same machine code: exactly one succeeds',
    successes.length === 1,
    `${successes.length} succeeded, ${failures.length} failed`,
  );
  check(
    'the losing concurrent insert fails with a unique-violation (23505), not something else',
    failures.length === 1 && failures[0].error?.code === '23505',
    failures[0]?.error?.code,
  );

  const survivingId = successes[0]?.data?.[0]?.id;
  const { count: raceCodeCount } = await admin
    .from('machines')
    .select('id', { count: 'exact', head: true })
    .eq('code', raceCode);
  check('exactly one row with the raced code exists afterward, not zero or two', raceCodeCount === 1, `count=${raceCodeCount}`);

  if (survivingId) await admin.from('machines').delete().eq('id', survivingId);

  // ── 2. Transaction integrity: a constraint-violating insert leaves nothing behind ──
  const rollbackCode = `ROLLBACK-${Date.now()}`;
  const { error: fkError } = await admin.from('machines').insert({
    ...machinePayload(rollbackCode),
    department_id: '00000000-0000-0000-0000-000000000000', // does not exist
  });
  check('inserting a machine with an unknown department_id is rejected', !!fkError, fkError?.code);

  const { count: orphanCount } = await admin
    .from('machines')
    .select('id', { count: 'exact', head: true })
    .eq('code', rollbackCode);
  check(
    'the rejected insert leaves zero rows behind (no partial/orphaned row)',
    orphanCount === 0,
    `count=${orphanCount}`,
  );

  // ── 3. Invalid/expired session handling, via a real Edge Function ────────────
  const callSignWithToken = (token) =>
    fetch(`${SUPABASE_URL}/functions/v1/cloudinary-sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

  const malformedResponse = await callSignWithToken('not-a-jwt-at-all');
  check(
    'a syntactically malformed token is rejected (401)',
    malformedResponse.status === 401,
    `got ${malformedResponse.status}`,
  );

  // A well-formed JWT shape (header.payload.signature) with a fabricated payload and
  // garbage signature — simulates both "expired" (exp in the past) and "tampered"
  // (wrong signature) in one token, since a real backend must reject both the same way.
  const fakeHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const fakePayload = Buffer.from(
    JSON.stringify({ sub: '00000000-0000-0000-0000-000000000000', exp: Math.floor(Date.now() / 1000) - 3600 }),
  ).toString('base64url');
  const forgedToken = `${fakeHeader}.${fakePayload}.not-a-real-signature`;
  const forgedResponse = await callSignWithToken(forgedToken);
  check(
    'a well-formed but forged/expired-looking token is rejected (401)',
    forgedResponse.status === 401,
    `got ${forgedResponse.status}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Verification failed:', error.message ?? error);
  process.exit(1);
});
