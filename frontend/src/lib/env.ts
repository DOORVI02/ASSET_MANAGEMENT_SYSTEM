/**
 * Typed, validated access to public (`VITE_*`) environment variables.
 *
 * Vite embeds every `VITE_*` value into the browser bundle, so only the Supabase
 * project URL and the publishable ("anon") key belong here — never a service-role key
 * or Cloudinary secret (`.agents/plan.md` section 15).
 *
 * Validation is lazy (`getSupabaseEnv()` throws only when called), not at module load,
 * so importing this file cannot crash the mock-data app before Phase 11 wires in real
 * Supabase calls. That is also why nothing in `src/App.tsx` imports it yet.
 */

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

function readVar(name: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = readVar('VITE_SUPABASE_URL');
  const publishableKey = readVar('VITE_SUPABASE_PUBLISHABLE_KEY');

  const missing = [
    !url && 'VITE_SUPABASE_URL',
    !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter((name): name is string => Boolean(name));

  if (missing.length > 0 || !url || !publishableKey) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. Copy .env.example to .env and fill in the project URL and publishable key.`,
    );
  }

  return { url, publishableKey };
}
