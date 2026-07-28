# Supabase backend

Live, linked to the hosted project `rlezcmnwemgtculvbaxh` since 2026-07-28. See
`supabase/RUNBOOK.md` for the operational reference (environments, credentials,
migrations, bootstrap/offboarding, backups, audit retention, Cloudinary
reconciliation) and `.agents/phases.md` for the full phase-by-phase evidence trail.
`.agents/plan.md` sections 11–15 are the architecture and security rules this follows.

## Layout

- `config.toml` — pushed to the live project via `supabase config push`. Auth/Storage
  settings here are the source of truth; edit here, then push, never change them only
  in the dashboard.
- `migrations/` — versioned schema SQL, applied in order via `supabase db push`.
  Additive only — see `RUNBOOK.md`'s "Migrations" section before touching an
  already-applied file.
- `seed.sql` — non-secret fixture data (provisional departments/technicians).
- `functions/` — deployed Edge Functions: `cloudinary-sign`, `cloudinary-finalize`,
  `cloudinary-delete` (Phase 12), plus `_shared/` helpers (`cors.ts`, `errors.ts`,
  `request-id.ts`, `auth.ts`, `validation.ts`, `cloudinary.ts`, `entities.ts`).
  Deployed with `supabase functions deploy <name> --use-api` (avoids needing
  Docker/Podman) and live-verified — see `scripts/README.md`.
- `scripts/` — server-only operator tools (roster bootstrap) and live verification
  scripts (`verify-*.mjs`) exercising the real project's RLS/Edge Functions/data
  integrity. Never deployed, never reachable over HTTP. See `scripts/README.md`.

## Commands

Run from the repository root with `npx supabase <command>` — no global install
required. `SUPABASE_ACCESS_TOKEN` (in the root `.env`) is required for `link`,
`config push`, `functions deploy`, and `secrets set`.

| Command | What it does |
| --- | --- |
| `npx supabase link --project-ref rlezcmnwemgtculvbaxh` | Associate this folder with the live project. Already done; re-run if working from a fresh clone. |
| `npx supabase db push` | Apply pending migrations under `migrations/` to the live project. |
| `npx supabase migration list` | Check applied vs. pending migrations before pushing. |
| `npx supabase config push` | Push `config.toml`'s Auth/Storage/API settings to the live project. |
| `npx supabase functions deploy <name> --use-api` | Deploy one Edge Function without needing Docker. |
| `npx supabase secrets set KEY=value` | Set an Edge Function secret (Cloudinary credentials, `ALLOWED_ORIGINS`, etc.). |
| `npx supabase secrets list` | List secret names (values shown hashed, not in plaintext). |

**Not available in this environment**: `supabase start`/`stop` (local stack),
`supabase db reset`, `supabase functions serve`, and `supabase gen types` — all
require Docker/Podman. See `RUNBOOK.md`'s "Generated types" section for the
hand-written substitute currently in use.
