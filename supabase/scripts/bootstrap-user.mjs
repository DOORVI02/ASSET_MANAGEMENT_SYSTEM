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
 * Add `--set-initial-password` to create the identity with a password already set
 * instead of sending an invite. Use this only when the operator must hand credentials
 * over directly (e.g. the invite email cannot reach the recipient in time). The password
 * is generated *here*, by this script, and printed once to stdout — it is never read
 * from the roster file, so enabling this mode still cannot put a password on disk. A
 * printed password must be treated as disclosed: change it through the normal recovery
 * flow before the account matters.
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
import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const args = process.argv.slice(2);
const SET_INITIAL_PASSWORD = args.includes('--set-initial-password');
const rosterPath = args.find((arg) => !arg.startsWith('--'));

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
  // Present-but-empty is allowed and means "not recorded yet". The key must still be
  // there, so a forgotten field is caught, but an operator who genuinely doesn't have
  // someone's number shouldn't have to invent one to get past this.
  if (typeof entry.phone !== 'string') problems.push('missing phone (use "" if unknown)');
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

/**
 * Generates a password that satisfies the app's own stated policy
 * (`frontend/src/lib/password-reset.ts`: 14 characters here vs. a 10-character floor
 * there, plus upper, lower, and digit). `randomInt` is the CSPRNG, not `Math.random`,
 * and symbols are omitted only so the value survives being pasted through a chat client
 * or terminal without escaping surprises — the extra length more than covers the lost
 * alphabet.
 */
function generatePassword() {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = lower + upper + digits;

  // Seeded with one of each required class so the result cannot fail the policy by
  // chance, then shuffled so those three are not always in positions 0-2.
  const chars = [
    lower[randomInt(lower.length)],
    upper[randomInt(upper.length)],
    digits[randomInt(digits.length)],
    ...Array.from({ length: 11 }, () => all[randomInt(all.length)]),
  ];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Creates the Auth identity, either by invite (the default, and the only path
 * `.agents/plan.md` section 13 describes) or with a generated password. Returns the new
 * user plus the password to disclose, if any.
 */
async function createIdentity(entry) {
  if (!SET_INITIAL_PASSWORD) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(entry.email);
    if (error) throw error;
    return { user: data.user, password: null };
  }

  const password = generatePassword();
  // `email_confirm: true` because no confirmation email is being sent in this path;
  // without it the identity exists but can never sign in.
  const { data, error } = await admin.auth.admin.createUser({
    email: entry.email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return { user: data.user, password };
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

  const { user, password } = await createIdentity(entry);

  const homeDepartmentId = departments.find((d) => d.code === entry.departmentCodes[0]).id;

  const { error: profileError } = await admin.from('profiles').insert({
    id: user.id,
    name: entry.name,
    email: entry.email,
    phone: entry.phone,
    role: entry.role,
    position: entry.position,
    department_id: homeDepartmentId,
  });
  if (profileError) throw profileError;

  // Inserted one row at a time, not as a batch: the supervisor single-department trigger
  // is a `before insert ... for each row` counter, and a multi-row statement would let a
  // supervisor past it because none of the rows are visible to the others yet.
  for (const department of departments) {
    const { error: scopeError } = await admin
      .from('profile_department_scope')
      .insert({ profile_id: user.id, department_id: department.id });
    if (scopeError) throw scopeError;
  }

  console.log(`Bootstrapped ${entry.email} as ${entry.role} (${entry.departmentCodes.join(', ')}).`);
  if (password) {
    console.log(`  initial password: ${password}`);
    console.log('  Hand this over out-of-band and change it before the account matters.');
  }
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
