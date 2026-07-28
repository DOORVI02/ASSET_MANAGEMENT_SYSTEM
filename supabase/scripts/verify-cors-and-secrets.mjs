#!/usr/bin/env node
/**
 * Live checks for a real gap found and fixed 2026-07-28: `ALLOWED_ORIGINS` had never
 * actually been set as an Edge Function secret since the Phase 8 `_shared/cors.ts`
 * skeleton was written — every Edge Function's CORS header was silently empty. That
 * would have broken every real browser call once the frontend actually invoked these
 * functions, even though every server-to-server test in this project (Node scripts,
 * which don't enforce CORS) worked fine and never surfaced it.
 *
 * Also re-confirms (as a standing regression check, not just a one-off grep) that no
 * Edge Function response ever echoes the Cloudinary API secret or the Supabase
 * service-role key — checked here against a real unauthenticated call, which is the
 * response an attacker actually gets, not just the source code.
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... CLOUDINARY_API_SECRET=... SUPABASE_SERVICE_ROLE_KEY=... node verify-cors-and-secrets.mjs
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
}

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  const allowedOrigin = 'http://localhost:5173';

  const preflight = await fetch(`${SUPABASE_URL}/functions/v1/cloudinary-sign`, {
    method: 'OPTIONS',
    headers: { Origin: allowedOrigin, 'Access-Control-Request-Method': 'POST' },
  });
  check(
    'CORS preflight from the allowed origin returns that exact origin',
    preflight.headers.get('access-control-allow-origin') === allowedOrigin,
    `got ${preflight.headers.get('access-control-allow-origin')}`,
  );

  const postResponse = await fetch(`${SUPABASE_URL}/functions/v1/cloudinary-sign`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Origin: allowedOrigin, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const bodyText = await postResponse.text();
  check(
    'an actual POST (not just the preflight) also carries the CORS header',
    postResponse.headers.get('access-control-allow-origin') === allowedOrigin,
    `got ${postResponse.headers.get('access-control-allow-origin')}`,
  );
  check('an unauthenticated call is rejected (401), not silently allowed', postResponse.status === 401);

  if (CLOUDINARY_API_SECRET) {
    check(
      "the unauthenticated call's response never contains the Cloudinary API secret",
      !bodyText.includes(CLOUDINARY_API_SECRET),
    );
  }
  if (SERVICE_ROLE_KEY) {
    check(
      "the unauthenticated call's response never contains the Supabase service-role key",
      !bodyText.includes(SERVICE_ROLE_KEY),
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Verification failed:', error.message ?? error);
  process.exit(1);
});
