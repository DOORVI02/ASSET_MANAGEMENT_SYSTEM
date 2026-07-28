#!/usr/bin/env node
/**
 * Removes the throwaway `@example.test` accounts that Phases 10–13's live verification
 * scripts left behind. Those scripts deliberately deactivate-and-ban rather than delete
 * (deleting a profile that has generated audit rows is blocked by design), so the residue
 * accumulates: 22 Auth identities and 21 profiles by 2026-07-29.
 *
 * Hard-coded to the `@example.test` suffix, which is reserved by RFC 6761 and can never be
 * a real address. A real roster account cannot match this filter, so the script cannot
 * delete a person.
 *
 * What it cannot remove, and why: `audit_logs` rejects `DELETE` outright via trigger, for
 * every caller including the service role (verified Phase 12). Verification rows in that
 * table are permanent. Any profile referenced by `audit_logs.performed_by` therefore also
 * cannot be deleted — `on delete restrict` exists precisely so an actor's history can't be
 * orphaned. Those profiles are deactivated and their Auth identity banned instead, and the
 * script reports them separately rather than pretending the purge was total.
 *
 * Dry run by default. Pass `--apply` to actually delete.
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node purge-verification-accounts.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const TEST_SUFFIX = '@example.test';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listTestAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  return users.filter((user) => user.email?.endsWith(TEST_SUFFIX));
}

async function main() {
  const authUsers = await listTestAuthUsers();
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, email')
    .like('email', `%${TEST_SUFFIX}`);
  if (profileError) throw profileError;

  // Which of these actors the append-only audit trail still points at.
  const { data: auditActors, error: auditError } = await admin
    .from('audit_logs')
    .select('performed_by')
    .in('performed_by', profiles.map((p) => p.id).concat('00000000-0000-0000-0000-000000000000'));
  if (auditError) throw auditError;
  const referenced = new Set(auditActors.map((row) => row.performed_by));

  const deletable = profiles.filter((p) => !referenced.has(p.id));
  const retained = profiles.filter((p) => referenced.has(p.id));

  console.log(`${authUsers.length} throwaway Auth identit(ies), ${profiles.length} profile(s).`);
  console.log(`  ${deletable.length} profile(s) deletable.`);
  console.log(`  ${retained.length} profile(s) retained — referenced by append-only audit_logs.`);
  for (const profile of retained) console.log(`    retained: ${profile.email}`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to delete.');
    return;
  }

  for (const profile of deletable) {
    await admin.from('profile_department_scope').delete().eq('profile_id', profile.id);
    const { error } = await admin.from('profiles').delete().eq('id', profile.id);
    if (error) {
      console.log(`  could not delete profile ${profile.email}: ${error.message}`);
      referenced.add(profile.id); // treat as retained so its identity is not deleted either
    }
  }

  // Retained profiles keep their Auth identity (deleting it would violate the same
  // `on delete restrict`), but it is deactivated and banned so it can never sign in.
  for (const profile of profiles.filter((p) => referenced.has(p.id))) {
    await admin.from('profiles').update({ is_active: false }).eq('id', profile.id);
    await admin.auth.admin.updateUserById(profile.id, { ban_duration: '876000h' });
  }

  let deletedIdentities = 0;
  for (const user of authUsers) {
    if (referenced.has(user.id)) continue;
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) console.log(`  could not delete identity ${user.email}: ${error.message}`);
    else deletedIdentities += 1;
  }

  console.log(
    `\nDeleted ${deletable.length - [...referenced].filter((id) => deletable.some((p) => p.id === id)).length} profile(s) and ${deletedIdentities} Auth identit(ies).`,
  );

  const { count: auditCount } = await admin
    .from('audit_logs')
    .select('*', { count: 'exact', head: true });
  console.log(
    `audit_logs still holds ${auditCount} row(s), including verification rows — that table is append-only by design and cannot be pruned here.`,
  );
}

main().catch((error) => {
  console.error('Purge failed:', error.message ?? error);
  process.exit(1);
});
