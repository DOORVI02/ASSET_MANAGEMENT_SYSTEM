# Agent Working Guide

## Required context and document ownership

Every agent must read `.agents/plan.md` and `.agents/phases.md` before starting work.

Each document has one purpose:

| Document            | Owns                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `README.md`         | Human onboarding, stack, commands, and repository map               |
| `Agents.md`         | Agent working rules and safety gates                                |
| `Claude.md`         | Claude-specific pointer; no duplicated project rules                |
| `.agents/plan.md`   | Product scope, architecture, security design, and durable decisions |
| `.agents/phases.md` | Tasks, current progress, evidence, blockers, and next phase         |
| `.agents/flow.md`   | User journeys and screen-to-screen behavior                         |

When implementation status changes, update `.agents/phases.md` only. Do not copy volatile progress into the other documents.

Repository layout:

- Outer repository: project coordination and planning; the only Git worktree (no nested repo).
- Active frontend: `frontend/`, a standalone Vite app (ported out of the now-deleted `Industrial-Asset-Hub/artifacts/sail-plant/` Replit workspace to drop Replit-only tooling and a nested git repo that blocked deployment).
- Frontend stack: React, Vite, TypeScript, Tailwind CSS, Wouter, shadcn/Radix, TanStack Query, and pnpm.
- Legacy `frontend/` (plain HTML/CSS/JS) predates `frontend/` at the repo root. Leave it alone unless explicitly asked to touch it.

## Current strategy: frontend first, backend gated

Finish every frontend page against mock/in-memory data, polish it, freeze the data contracts, and get explicit human acceptance—only then does Supabase/Cloudinary work begin. **Do not connect to Supabase, read `cloudinary.txt`/`supabase.txt`, create migrations, or call Cloudinary until the user explicitly starts the backend phase.**

## Frontend conventions

Reuse the established foundation instead of creating competing patterns:

- `frontend/` has Prettier, ESLint, Vitest, and React Testing Library configured through `pnpm` scripts.
- Shared UI states and patterns live in `src/components/shared/`: `LoadingState`, `FeedbackMessage`, `PageSection`, and `ListToolbar`; retain the existing shadcn/Radix visual language.
- `src/lib/mock-repository.ts` is the temporary typed in-memory boundary. Pages must not mutate `mock-data.ts` imports directly.
- `Role` is Officer and Supervisor only; Viewer was removed from product scope on 2026-07-25. The role switcher is expressly **preview-only**; it is never authorization.
- Route manifests and smoke tests are in `src/lib/routes.ts` and `src/lib/routes.test.ts`.
- The verified commands, run from `frontend/`, are `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

Read `.agents/phases.md` immediately before starting any task. Check the current files and Git status for concurrent work, and do not duplicate or overwrite another session. The roadmap, not this file, determines the next available phase.

## Non-negotiable rules

1. Preserve and adapt the existing frontend and UI design. Do not rebuild it or migrate frameworks.
2. Work on one roadmap phase or bounded task at a time; frontend phases finish before backend phases start.
3. Inspect relevant code, conventions, dependencies, and Git status before editing; state the expected files.
4. Do not overwrite working or user-authored code without explicit approval.
5. Use strict TypeScript. Avoid `any` unless unavoidable and documented.
6. Explain new libraries and keep the pnpm lockfile consistent.
7. Once the backend phase starts: use Supabase email/password Auth. Gmail addresses are ordinary emails; do not configure Google OAuth or public self-registration.
8. Once the backend phase starts: enforce Officer and Supervisor access with PostgreSQL RLS. Hidden buttons and client role checks are not security, before or after.
9. Once the backend phase starts: store authorization in protected application data, not user-editable metadata. Prevent role self-escalation.
10. Once the backend phase starts: represent every database change with a versioned SQL migration and regenerate Supabase types.
11. Once the backend phase starts: use Supabase Edge Functions for Cloudinary signatures, upload finalization, image deletion, privileged admin operations, cleanup, and anything requiring secrets.
12. Never expose service-role keys or Cloudinary secrets in the Vite frontend, `VITE_*`, logs, responses, or committed files.
13. Once the backend phase starts: keep ordinary data operations under the user JWT and RLS; do not bypass RLS with service role for convenience.
14. Validate all mutations at the appropriate boundary; enforce integrity again in PostgreSQL once it exists.
15. Preserve history with archive/void operations and audit metadata rather than hard deletion — true in the mock layer too.
16. Do not commit or expose `.env`, `.env.local`, passwords, tokens, credentials, real user data, or secret-bearing text files. `cloudinary.txt`/`supabase.txt` are gitignored reference files for later `.env` setup — don't read or act on them during frontend phases.
17. Do not commit, push, deploy, or mutate production unless explicitly requested.
18. Treat all existing untracked changes as user work unless they are clearly part of the active task; inspect before editing and do not clean or reset the worktree.

## Phase completion

A task is complete only when its acceptance criteria are met and the applicable format, lint, strict typecheck, tests, production Vite build, and manual verification pass (RLS/security checks apply once the backend phase starts). Summarize evidence and blockers, then update only the completed checkboxes in `.agents/phases.md`.

If instructions conflict or a required decision is unresolved, stop and ask rather than making a risky assumption.
