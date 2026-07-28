#!/usr/bin/env node
/**
 * One-time, server-only operator bootstrap (.agents/plan.md section 13).
 *
 * Creates a Supabase Auth identity and its matching `profiles`/`profile_department_scope`
 * rows together, from a roster entry the project operator supplies — never from browser
 * input, never from `user_metadata`. This is a script the operator runs from their own
 * machine with the service-role key; it is deliberately **not** an Edge Function, so it
 * is never reachable over HTTP by anyone, roster or not.
 *
 * The user is invited, not given a password: `inviteUserByEmail` creates the Auth
 * identity with no password set and sends a recovery-style email so the employee
 * establishes their own first password through Supabase's secure recovery flow
 * (plan.md: "Users establish or change their password through Supabase Auth's secure
 * recovery flow; application tables never store password values or hashes"). Sending
 * that email requires SMTP to be configured on the project — done 2026-07-28 (Gmail
 * SMTP via an app password, see `config.toml`'s `[auth.email.smtp]`), and a real
 * `inviteUserByEmail` call to a real inbox succeeded. This script's own logic (the
 * roster validation, department lookup, profile/scope insert) is still only verified
 * with `admin.createUser` as a structural stand-in, not with a real roster run — see
 * `scripts/README.md` for exactly what is and isn't verified.
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node bootstrap-user.mjs roster.local.json
 *
 * The roster file is never committed (see .gitignore) and must never contain a
 * password — there is no password field in the schema below for exactly that reason.
 *
 * Roster file shape, one entry per employee:
 * [
 *   {
 *     "email": "name@sail.in",
 *     "name": "Full Name",
 *     "phone": "+91 90000 00000",
 *     "role": "officer" | "supervisor",
 *     "position": "Maintenance Officer",
 *     "departmentCodes": ["SP3", "COB"]   // Supervisor must supply exactly one
 *   }
 * ]
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rosterPath = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  process.exit(1);
}
if (!rosterPath) {
  console.error('Usage: node bootstrap-user.mjs <roster.local.json>');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function validateEntry(entry, index) {
  const problems = [];
  if (!entry.email) problems.push('missing email');
  if (!entry.name) problems.push('missing name');
  if (!entry.phone) problems.push('missing phone');
  if (entry.role !== 'officer' && entry.role !== 'supervisor') {
    problems.push(`role must be "officer" or "supervisor", got ${JSON.stringify(entry.role)}`);
  }
  if (!entry.position) problems.push('missing position');
  if (!Array.isArray(entry.departmentCodes) || entry.departmentCodes.length === 0) {
    problems.push('departmentCodes must be a non-empty array');
  }
  if (entry.role === 'supervisor' && entry.departmentCodes?.length !== 1) {
    problems.push('a supervisor must have exactly one department code (flow.md section 6.2)');
  }
  if (problems.length > 0) {
    throw new Error(`Roster entry ${index} (${entry.email ?? 'unknown email'}) is invalid: ${problems.join('; ')}`);
  }
}

async function bootstrapOne(entry) {
  const { data: departments, error: deptError } = await admin
    .from('departments')
    .select('id, code')
    .in('code', entry.departmentCodes);
  if (deptError) throw deptError;

  const foundCodes = new Set(departments.map((d) => d.code));
  const missing = entry.departmentCodes.filter((c) => !foundCodes.has(c));
  if (missing.length > 0) {
    throw new Error(`${entry.email}: unknown department code(s) ${missing.join(', ')}`);
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(entry.email);
  if (inviteError) throw inviteError;

  const homeDepartmentId = departments.find((d) => d.code === entry.departmentCodes[0]).id;

  const { error: profileError } = await admin.from('profiles').insert({
    id: invited.user.id,
    name: entry.name,
    email: entry.email,
    phone: entry.phone,
    role: entry.role,
    position: entry.position,
    department_id: homeDepartmentId,
  });
  if (profileError) throw profileError;

  const { error: scopeError } = await admin.from('profile_department_scope').insert(
    departments.map((d) => ({ profile_id: invited.user.id, department_id: d.id })),
  );
  if (scopeError) throw scopeError;

  console.log(`Bootstrapped ${entry.email} as ${entry.role} (${entry.departmentCodes.join(', ')}).`);
}

async function main() {
  const roster = JSON.parse(readFileSync(rosterPath, 'utf8'));
  if (!Array.isArray(roster) || roster.length === 0) {
    throw new Error('Roster file must be a non-empty JSON array.');
  }
  roster.forEach(validateEntry);

  for (const entry of roster) {
    await bootstrapOne(entry);
  }
}

main().catch((error) => {
  console.error('Bootstrap failed:', error.message ?? error);
  process.exit(1);
});
