# Operator scripts

Server-only, run manually by the project operator from their own machine. Never
deployed as an Edge Function, never reachable over HTTP, never run by the application.

## `bootstrap-user.mjs`

Creates one Supabase Auth identity plus its matching `profiles` and
`profile_department_scope` rows, from a roster entry — see the script's own header
comment for the full usage and roster file shape.

```sh
npm install                 # once
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
node bootstrap-user.mjs roster.local.json
```

**Never commit a roster file.** `.gitignore` blocks `roster*.json`, but treat that as a
backstop, not the plan — the roster contains real employee emails, which
`.agents/plan.md` section 13 says must never be committed to any file, migration, or
seed.

**Verified 2026-07-27, with one honest gap.** Running the actual script against a
throwaway `@example.com`/`@example.test` address failed: `inviteUserByEmail` rejects
both as "invalid", almost certainly because GoTrue checks the domain can actually
receive mail (neither is a real mail-accepting domain). That check is exactly why real
roster addresses will work fine and these harmless test ones don't — this is not a bug
in the script. The rest of the script's logic — department-code lookup and rejection of
an unknown code, the profile insert, and the department-scope insert — **was verified**
using `admin.createUser` as a stand-in for the one call that needs a real deliverable
address, all 7 checks passing, all test rows cleaned up.

**Not verified**: `inviteUserByEmail` actually sending mail to a real inbox, and SMTP
delivery generally (SMTP ownership is still an open decision, `.agents/flow.md` section
16). The first real run against the actual roster is the first time this specific call
will be genuinely exercised — expect to confirm invite emails are actually arriving
before trusting the roster run to be complete.

## `verify-data-layer.mjs`

Live smoke test for the Phase 11 data-access layer (`frontend/src/lib/supabase/*.ts`)
against the real hosted project and real RLS — re-implements the same query shapes
inline with `@supabase/supabase-js` rather than importing the TypeScript modules
directly (those use the `@/` path alias and only run through Vite).

```sh
npm install                 # once
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...
node verify-data-layer.mjs
```

Creates one throwaway `@example.test` Auth identity scoped to a single seed department
(Officer role), signs in for a real JWT, and checks under that JWT: department reads are
scoped to the caller's own department; an Officer can create a machine in their own
department; `machines_with_derived` exposes it with derived fields populated; creating a
machine in an out-of-scope department is rejected by RLS; `department_summary` reflects
the new machine; archive/restore both work; and machines in an out-of-scope department
are invisible. **Verified 2026-07-27, 8/8 checks passing.**

**Cleanup note**: the test machine is hard-deleted, but the test profile and Auth
identity are not — `audit_logs` is genuinely append-only (a trigger rejects `DELETE`
outright, even for the service role, once the actor has any audit rows), so once the
test account has acted it can never be hard-deleted without raw DDL. The script
deactivates it instead (drops its department scope, sets `profiles.is_active = false`,
bans the Auth identity) — the same soft-delete convention this schema uses everywhere
else. Running the script repeatedly accumulates deactivated, access-less
`phase11-verify-*@example.test` rows; that's expected and harmless, not a leak to chase
down.

## `verify-embed-scoping.mjs`

Live regression check for a real bug this script's first run caught and the fix it
confirmed: `parts.ts`/`maintenance.ts`/`repairs.ts` narrow department-scoped list
queries with `.in('machine.department_id', [...])` — a filter on an embedded (joined)
resource's column, not a plain own-table column. `verify-data-layer.mjs` never
exercised this (it only filters `machines` directly), and it turned out PostgREST
silently ignores a dot-filter on the *default* (left-join) embed — the filter parses
but never narrows results. The fix, applied to all three modules' `*_SELECT` constants,
is `machine:machines!inner(...)` — `!inner` turns the embed into a real join condition
the filter can act on. (RLS itself already prevents cross-department leakage regardless
of this bug — this is about correctness of further narrowing within a caller's own
multi-department scope, e.g. an Officer scoped to two departments asking for just one's
parts, not a security boundary.)

```sh
npm install                 # once
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...
node verify-embed-scoping.mjs
```

**Verified 2026-07-27, 2/2 checks passing** against the fixed code. Same cleanup
approach as `verify-data-layer.mjs` (deactivate rather than hard-delete the test
identity); the test machines/parts themselves are hard-deleted since nothing FKs to
them with `RESTRICT`.

## `verify-anon-function-lockdown.mjs`

Live regression check for a real security gap found and fixed 2026-07-28:
`20260727000012_auth_helper_functions.sql` documented `auth_role()`,
`auth_department_ids()`, `auth_can_see_archived()`, and `entity_department_id()` as
"revoked from PUBLIC and granted only to authenticated" — but a live check against
`information_schema.routine_privileges` on the hosted project showed `anon` held
EXECUTE on all four anyway. Root cause: Supabase provisions new projects with default
privileges that auto-grant EXECUTE on new *functions* to `anon`/`authenticated` — the
same platform default the RLS migration already had to work around for *tables*
("revoke all on all tables in schema public from anon"), just missed for functions.
`REVOKE ... FROM PUBLIC` doesn't touch a role's own separate default grant.
`20260727000015_lock_down_auth_helper_functions.sql` explicitly revokes EXECUTE from
`anon` on all four.

`auth_role()`/`auth_department_ids()`/`auth_can_see_archived()` are all gated on
`auth.uid()` (null for `anon`), so they leaked nothing in practice — but
`entity_department_id(entity_type, entity_id)` takes no identity-bound parameter and,
being `security definer`, bypasses RLS entirely: an unauthenticated caller could learn
which department any machine/part/maintenance/repair record belongs to, given or by
enumerating its UUID. That was the real, exploitable part of this gap.

```sh
npm install                 # once
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
node verify-anon-function-lockdown.mjs
```

Needs only the anon key/JWT — no service role, no throwaway account, nothing to clean
up. **Verified 2026-07-28, 5/5 checks passing.**

**Going forward**: any new `security definer` function added to `public` (Phase 12's
Cloudinary Edge Functions may add more, if any call Postgres RPCs directly) needs its
own explicit `revoke execute ... from anon` — this is a project-wide default privilege,
not a one-time fix, so it will silently recur for every new function unless each one
addresses it.

## `verify-actor-spoofing.mjs`

Live check for a Phase 10 gap carried over as "not yet attempted": actor spoofing.
`part_replacements_insert`'s RLS policy requires `performed_by = auth.uid()` — a caller
must name themself as the actor, never an arbitrary other profile. Proves it by
attempting to record a replacement with `performed_by` set to a *different* real
profile's id (rejected), then confirming the same caller recording themself as the
actor succeeds.

```sh
npm install                 # once
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...
node verify-actor-spoofing.mjs
```

**Verified 2026-07-28, 2/2 checks passing.**

A second check — whether a public self-signup account (`disable_signup` is still
`false` on the live project) can act as a real user despite having no `profiles` row —
was also attempted here but had to be dropped: `supabase.auth.signUp()` against an
`@example.test` address is rejected by GoTrue's email validation, the same
domain-validation limitation already documented above for `inviteUserByEmail`. Testing
it properly needs a real deliverable domain, which this environment deliberately does
not guess at. `disable_signup` itself is now resolved — see `.agents/phases.md` Phase 10.

## `verify-cloudinary-sign.mjs`

Live end-to-end check for the Phase 12 `cloudinary-sign` Edge Function: creates a
throwaway Officer and a real machine, calls the deployed function for a real JWT, and
actually uploads a tiny real image to Cloudinary with the returned signed params —
proving the signature Cloudinary computes server-side from what it received matches
what the function produced, not just that it returns *something*. Also checks a
disallowed file type is rejected before any signature is computed, and that a machine
outside the caller's department is rejected.

```sh
npm install                 # once
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...
export CLOUDINARY_API_SECRET_FOR_CLEANUP=...   # optional — lets the script delete its own test upload
node verify-cloudinary-sign.mjs
```

**Verified 2026-07-28, 4/4 checks passing**, test asset cleaned up (confirmed via a
direct Cloudinary Admin API resources listing). Same test-identity cleanup approach as
`verify-data-layer.mjs` (deactivate rather than hard-delete); the test machine is
hard-deleted since nothing FKs to it with `RESTRICT`.

## `verify-cloudinary-lifecycle.mjs`

Live end-to-end check for the full Phase 12 lifecycle: sign → upload to Cloudinary →
`cloudinary-finalize` → replace → `cloudinary-delete`, covering both entity shapes.
For a machine (single-image, replace-on-upload): uploads twice, confirms exactly one
`attachments` row exists throughout and that replacing reuses the same row id *and*
the same Cloudinary `public_id` (the fixed-slot design — the old asset is overwritten
in place, never orphaned), then deletes it. For a repair (multi-image): uploads twice,
confirms **two** distinct rows exist (not a replace), deletes one, confirms the other
survives untouched, then deletes it too.

```sh
npm install                 # once
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...
# Optional — lets the script clean up any Cloudinary asset a failed run left behind
# (the happy path already deletes everything itself via cloudinary-delete):
export CLOUDINARY_API_SECRET_FOR_CLEANUP=...
export CLOUDINARY_API_KEY_FOR_CLEANUP=...
export CLOUDINARY_CLOUD_NAME_FOR_CLEANUP=...
node verify-cloudinary-lifecycle.mjs
```

**Verified 2026-07-28, 11/11 checks passing**, confirmed zero leftover Cloudinary
assets and zero leftover test rows afterward.

## `verify-cors-and-secrets.mjs`

Live regression check for a real gap found and fixed 2026-07-28: `ALLOWED_ORIGINS`
had never actually been set as an Edge Function secret since the Phase 8
`_shared/cors.ts` skeleton was written. Every Edge Function's CORS header was
silently empty — invisible to every test in this project up to this point, since
those are all Node scripts (server-to-server calls don't enforce CORS), but it would
have broken every real browser call the moment the frontend actually invoked these
functions. Fixed by `supabase secrets set ALLOWED_ORIGINS=http://localhost:5173`
(matching the existing `.env` value). Also reconfirms, against a live unauthenticated
response rather than just source code, that no Edge Function ever echoes the
Cloudinary API secret or the Supabase service-role key.

```sh
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
export CLOUDINARY_API_SECRET=...        # optional, strengthens the secret-leak check
export SUPABASE_SERVICE_ROLE_KEY=...    # optional, strengthens the secret-leak check
node verify-cors-and-secrets.mjs
```

**Verified 2026-07-28, 5/5 checks passing.**

## `reconcile-cloudinary-orphans.mjs`

Operational tool, not a test: compares real Cloudinary assets under
`sail-plant-maintenance/` against `attachments.cloudinary_public_id` rows and reports
drift in both directions — orphaned Cloudinary assets (uploaded but never finalized,
e.g. the browser closed between upload and `cloudinary-finalize`) and dangling
attachment rows (pointing at a Cloudinary asset that no longer exists, e.g. deleted
out-of-band in the Cloudinary dashboard). Report-only by default; pass
`--delete-orphans` to actually destroy the orphaned Cloudinary assets it found (never
touches the `attachments` table either way, and never deletes anything with a
matching row regardless of flags).

```sh
npm install                 # once
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export CLOUDINARY_CLOUD_NAME=...
export CLOUDINARY_API_KEY=...
export CLOUDINARY_API_SECRET=...
node reconcile-cloudinary-orphans.mjs               # report only
node reconcile-cloudinary-orphans.mjs --delete-orphans   # also clean up orphans found
```

**Verified 2026-07-28**: ran clean against the real project (zero drift, matching
every other verify script's own cleanup); then a genuine orphan was manually created
(a real Cloudinary upload with no corresponding `attachments` row) and confirmed
detected; then confirmed `--delete-orphans` actually removes it, and a final run
confirms zero drift again afterward.

## `verify-concurrency-and-sessions.mjs`

Live checks for Phase 13's "concurrency, transaction rollback, expired sessions" task
— the part of it achievable without the frontend auth+data cutover, since these
exercise the live database and Edge Functions directly rather than the UI. Fires two
simultaneous machine-creation requests with the same code and confirms exactly one
wins (a real race against `machines_code_key`, not a sequential check-then-insert);
confirms a constraint-violating insert (unknown `department_id`) leaves zero
partial/orphaned rows; and confirms a syntactically malformed token and a
well-formed-but-forged/expired-looking token are both rejected the same way by
`getAuthorizedCaller`.

```sh
npm install                 # once
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...
node verify-concurrency-and-sessions.mjs
```

**Verified 2026-07-28, 7/7 checks passing.**
