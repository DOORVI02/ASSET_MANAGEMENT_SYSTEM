/**
 * Actor-name lookups. `performedBy`/`uploadedBy`/`reportedBy`/`assignedTo` are raw
 * profile ids everywhere in the DB and the UI contract alike (confirmed against
 * `PartDetailPage.tsx`'s `actorName()` helper) — this is the one place that resolves
 * ids to display names, and only when a page asks for it.
 *
 * `profiles` has no per-row RLS beyond `id = auth.uid()` (see
 * `20260727000013_rls_policies_and_grants.sql`), so a plain select can only ever resolve
 * the caller's own name. `listDisplayNames` below goes through the
 * `profile_display_names` RPC added in migration `20260728000018` — the "dedicated
 * security definer RPC" this file's earlier note said would be needed.
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

/**
 * Resolves actor ids to display names, for the `performedBy`/`uploadedBy`/`reportedBy`/
 * `assignedTo` fields that every detail screen renders.
 *
 * Returns a `Map` rather than an array because that is how callers use it — one lookup per
 * rendered row — and because the result is deliberately *incomplete*: an id outside the
 * caller's department scope simply isn't in the map. Callers must handle a miss (showing
 * the raw id, or "Unknown"), not assume every id resolves. That is the RPC's access rule
 * showing through, not an error.
 */
export async function listDisplayNames(ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const client = getSupabaseClient();
  const { data, error } = await client.rpc('profile_display_names', { p_ids: unique });
  if (error) throw error;

  return new Map((data ?? []).map((row) => [row.id, row.name]));
}
