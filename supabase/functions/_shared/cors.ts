/**
 * CORS handling shared by every Edge Function.
 *
 * `ALLOWED_ORIGINS` is a comma-separated secret (`.agents/plan.md` section 15), set per
 * environment via `supabase secrets set` — never hard-code a production origin here.
 *
 * Untested against a running function: this repository has no Docker available, and
 * `supabase functions serve` needs it. Written to the documented Edge Function
 * conventions; exercise it for real once local or staging serving is available.
 */

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function corsHeaders(requestOrigin: string | null): HeadersInit {
  const origin =
    requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': origin ?? '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** Returns a 204 response for a preflight `OPTIONS` request, or `null` for anything else. */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}
