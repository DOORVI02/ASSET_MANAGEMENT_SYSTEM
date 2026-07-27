/**
 * Actor-name lookups. `performedBy`/`uploadedBy`/`reportedBy`/`assignedTo` are raw
 * profile ids everywhere in the DB and the UI contract alike (confirmed against
 * `PartDetailPage.tsx`'s `actorName()` helper) — this is the one place that resolves
 * ids to display names, and only when a page asks for it.
 *
 * `profiles` has no per-row RLS beyond `id = auth.uid()` (see
 * `20260727000013_rls_policies_and_grants.sql`), so a signed-in user can only ever
 * resolve their own name this way today. Resolving other users' names will need a
 * dedicated `security definer` RPC — not yet built, out of scope for Phase 11's data
 * layer per the user's "build the data layer now, wire in later" decision.
 */
import { getSupabaseClient } from '@/lib/supabase';

export async function getOwnProfileName(): Promise<string | undefined> {
  const client = getSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return undefined;

  const { data, error } = await client
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.name;
}
