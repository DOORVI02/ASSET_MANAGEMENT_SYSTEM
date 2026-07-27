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
