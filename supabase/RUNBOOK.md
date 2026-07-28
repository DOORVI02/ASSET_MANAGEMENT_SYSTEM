# Operations runbook

Consolidated reference for running and maintaining this project's Supabase backend.
Written 2026-07-28 as part of Phase 13. Where something isn't done yet, this file says
so directly rather than describing an aspirational process — see `.agents/phases.md`
for the full evidence trail behind every claim here.

## Environments

**Only one environment currently exists: the live hosted project**
(`rlezcmnwemgtculvbaxh`, linked via `supabase link --project-ref rlezcmnwemgtculvbaxh`).
There is no separate staging or production Supabase project, and no separate
staging/production Cloudinary account — `.agents/plan.md` section 16 calls for
"separate local/staging/production Supabase and Cloudinary environments," but that
split has not been provisioned. Every migration, Edge Function deploy, and live
verification in this project (Phases 9–13) ran directly against this one project.

Provisioning a second (staging) project is a real, billable infrastructure decision —
not something to do without explicit sign-off, since it creates an ongoing resource the
project owner is responsible for. Until that happens, treat this project as "the only
environment, be as careful with it as you would with production."

**Local development** (`supabase start`, a local Postgres+Auth+Storage stack in
Docker) has never been used in this session — Docker/Podman is unavailable in this
environment. Migrations were applied to the live project directly instead, via
`supabase db push` (originally with `--db-url`, later via `supabase link` once a
personal access token was available — see below).

## Access and credentials

- **Personal access token** (`SUPABASE_ACCESS_TOKEN` in the root `.env`, never
  committed): unlocks `supabase link`, `db push` without the `--db-url` workaround,
  `config push` (Auth/Storage settings), `functions deploy`, and `secrets set`. This
  token is account-wide, not project-scoped — it can manage any project the token's
  owner has access to, so treat it with the same care as a root credential.
- **Service-role key** (`SUPABASE_SERVICE_ROLE_KEY`): bypasses RLS entirely. Used only
  in `supabase/scripts/*.mjs` (server-only, never deployed) and inside Edge Functions
  (`_shared/auth.ts`'s `serviceRoleClient()`). Never in frontend code.
- **Anon/publishable key** (`SUPABASE_ANON_KEY`): the only Supabase credential the
  frontend bundle carries. Safe to expose — every real permission boundary is RLS and
  Edge Function JWT validation, not this key.
- **Cloudinary API secret**: lives only in the Edge Function secret store
  (`supabase secrets set CLOUDINARY_API_SECRET=...`), never in frontend code. Verified
  absent from the production bundle and from every Edge Function response — see
  `supabase/scripts/verify-cors-and-secrets.mjs`.
- **DB password**: exposed once in a tool-output transcript during Phase 9 (a `sed`
  redaction bug, immediately disclosed to the project owner). Rotation was explicitly
  deferred by the owner ("I will do it after") and **remains unrotated as of this
  writing** — a known, disclosed, open item, not a hidden one.

## Migrations

- All schema changes are versioned SQL files under `supabase/migrations/`, applied
  with `supabase db push`. Never hand-edit the live schema outside a migration file.
- **Additive only, no down-migrations.** Every fix in this project (RLS grant
  corrections, the `disable_signup` toggle, etc.) shipped as a *new* migration or a
  `config.toml` change plus `config push` — never an edit to an already-applied
  migration file. If a migration turns out to be wrong, write a new migration that
  corrects it forward; do not edit history.
- `supabase db reset` (drop and rebuild from migrations + `seed.sql`) has deliberately
  **never been run** against the live project — it is destructive and this project has
  no local stack to run it against instead. If a from-scratch rebuild is ever needed,
  it must be a new project, not a reset of the current one.
- `supabase migration list` shows what's applied vs. pending; run it before any
  `db push` if there's any doubt about drift.

## Generated types

`frontend/src/lib/database.types.ts` is **real `supabase gen types` output**, as of
2026-07-28. Earlier phases (9 and 11) believed this command required a container
runtime (Docker/Podman) even against a remote project — that turned out to be wrong
for CLI 2.110.0, caught by a documentation walkthrough that actually ran the command
the docs described instead of trusting the earlier note. Regenerate it after any
migration with:

```sh
cd supabase
supabase gen types typescript --linked > ../frontend/src/lib/database.types.ts
```

(`SUPABASE_ACCESS_TOKEN` must be set.) Keep the `Database` export name so
`src/lib/supabase.ts` doesn't need to change. One real thing regenerating surfaced:
Postgres's view-column introspection reports every column of a view (including
`machines_with_derived`'s summary views) as nullable, even when the underlying join is
through a `NOT NULL` foreign key that can never actually produce null — `mappers.ts`
handles the base-machine columns with a documented `assumeNonNull` helper, and the
aggregate-count views with `?? 0` (matching what their own SQL already guarantees via
`COALESCE`). Re-check both after every regeneration in case a future migration
actually changes what can be null.

## Auth bootstrap and offboarding

- **Bootstrap**: `supabase/scripts/bootstrap-user.mjs`, run manually by the project
  operator with the service-role key — never deployed, never reachable over HTTP. See
  its own header comment for the roster JSON shape. Creates the Auth identity
  (`inviteUserByEmail`, no password stored) plus matching `profiles`/
  `profile_department_scope` rows in one call. **Never run against real employee data
  yet** — only verified with `admin.createUser` as a structural stand-in (Phase 10) and
  against throwaway `@example.test` accounts (every `verify-*.mjs` script since).
- **SMTP is configured** (Gmail via an app password — `config.toml`'s
  `[auth.email.smtp]`, wired 2026-07-28), so invite/recovery emails have somewhere to
  actually send from. A real `inviteUserByEmail` call against a real inbox succeeded
  at the API level; see `scripts/README.md` for whether inbox delivery itself has been
  confirmed yet. This script's own roster→invite→profile path as one unit is still
  only exercised with the `admin.createUser` stand-in above, not a real roster entry.
- **Offboarding**: there is no separate offboarding script. Set `profiles.is_active =
  false` for the departing user (every RLS policy and every `security definer` helper
  function checks this — access stops the instant it flips, before the JWT itself
  expires) and optionally ban the Auth identity with
  `admin.updateUserById(id, { ban_duration: '876000h' })` (the pattern every verify
  script's own cleanup uses) so it can never sign in again. Never hard-delete a
  profile — `audit_logs.performed_by` and other tables reference it with `ON DELETE
  RESTRICT` specifically so a departing user's history can't be deleted out from under
  the audit trail.
- **Self-registration is disabled** (`disable_signup: true`, fixed 2026-07-28 — see
  `.agents/phases.md` Phase 10). Only the bootstrap script creates accounts.

## Backups and restore

Supabase's hosted platform takes automatic daily backups on paid tiers (point-in-time
recovery on higher tiers) — **this has not been independently confirmed for this
specific project's plan tier**, and no test restore has ever been performed from this
environment. Before treating backups as a safety net, confirm the project's actual
plan/backup retention in the Supabase dashboard and perform a real test restore (to a
*new* project, never restore-in-place onto the live one) at least once before this
matters in an incident.

## Audit retention

`audit_logs` is append-only by design (a trigger rejects `DELETE` outright, even for
the service role — confirmed live, Phase 12) and grows without bound. **No retention
or archival policy exists yet** — `.agents/plan.md`'s "audit retention" decision is
still open (Phase 13 audit finding). Before this table grows large enough to matter
operationally, decide and implement a retention policy (e.g. archive-and-truncate rows
older than N years to cold storage) — do not solve this by adding a DELETE path to the
live table, which would undermine the append-only guarantee the whole design relies on.

## Cloudinary reconciliation

Run `supabase/scripts/reconcile-cloudinary-orphans.mjs` periodically (no scheduled job
exists yet — this is a manual tool) to compare live Cloudinary assets against
`attachments.cloudinary_public_id` rows. It reports orphaned Cloudinary assets
(uploaded but never finalized — the gap `cloudinary-finalize` failing after a
successful upload would create) and dangling attachment rows (pointing at a deleted
asset) in both directions, and can delete confirmed orphans with `--delete-orphans`.
See `supabase/scripts/README.md` for full usage and the verification this tool itself
received (a real orphan was manually created, detected, and cleaned up before this
tool was trusted).

## Forward-fix vs. rollback

This project has no rollback mechanism for either migrations or Edge Function
deploys — `supabase functions deploy` and `db push` both simply apply the current
state of `supabase/` to the live project. If a deploy introduces a regression:

- **Edge Functions**: fix the source and redeploy (`supabase functions deploy <name>
  --use-api`). Functions are stateless and versionless from the CLI's perspective —
  there is no `functions rollback`.
- **Migrations**: write a new migration that corrects the problem (see "Migrations"
  above). Never edit or delete an already-applied migration file.
- **Config** (`config.toml`, pushed via `config push`): same principle — change the
  file and push again; there is no separate rollback command.

In every case: fix forward, verify live (this project's own convention throughout —
every fix in Phases 9–13 was followed by a live re-verification script, not just a
code change), and record what happened in `.agents/phases.md`.
