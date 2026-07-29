import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';
import type { Database } from './database.types';

/**
 * The one browser Supabase client, per `.agents/plan.md` section 11: URL and
 * publishable key only. Ordinary reads and user-authorized mutations go through this
 * client under the signed-in user's JWT and PostgreSQL RLS — it never carries a
 * service-role key, which belongs only to Edge Functions.
 *
 * Every page reads and writes through this client as of the 2026-07-29 cutover; the mock
 * repository it replaced has been deleted.
 */
let client: SupabaseClient<Database> | undefined;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    const { url, publishableKey } = getSupabaseEnv();
    client = createClient<Database>(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}
