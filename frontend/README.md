# frontend — SAIL Plant Maintenance and Machine Asset Register

The active frontend for the plant maintenance and machine asset register. A standalone
Vite single-page application, currently running entirely against an in-memory mock
repository. **No backend is connected.**

Planning documents live in `../.agents/`. `plan.md` owns product and architecture
decisions, `phases.md` owns implementation progress and evidence, and `flow.md` owns user
journeys. Agent working rules are in `../Agents.md`.

## Commands

Run from this directory. `pnpm` is required — the lockfile is `pnpm-lock.yaml`.

| Command             | What it does                         |
| ------------------- | ------------------------------------ |
| `pnpm dev`          | Vite dev server                      |
| `pnpm build`        | Production build into `dist/`        |
| `pnpm preview`      | Serve the production build           |
| `pnpm typecheck`    | `tsc --noEmit`, strict               |
| `pnpm lint`         | ESLint, `--max-warnings=0`           |
| `pnpm format`       | Prettier write                       |
| `pnpm format:check` | Prettier check — part of the gate    |
| `pnpm test`         | Vitest, single run                   |
| `pnpm test:watch`   | Vitest, watch mode                   |
| `pnpm e2e`          | Playwright, both projects            |
| `pnpm e2e:ui`       | Playwright, interactive UI mode      |
| `pnpm e2e:report`   | Open the last Playwright HTML report |

A change is only complete when `format:check`, `lint`, `typecheck`, `test`, and `build`
all pass. `pnpm e2e` is real-browser coverage layered on top — see below.

## Stack

React 19, Vite 7, TypeScript 5.9 (strict), Tailwind CSS 4, Wouter, shadcn/ui on Radix,
TanStack Query (provider mounted, no consumers yet), Recharts, Sonner, Lucide,
React Hook Form, date-fns, Zod. Vitest and React Testing Library for component/unit
tests; Playwright for real-browser E2E and visual regression.

## Real-browser testing (Playwright)

Added 2026-07-27. jsdom (what Vitest uses) has no layout engine — it can prove a
responsive branch exists and carries the right data, but never that it renders
correctly. Playwright closes that gap; it does not replace the Vitest suite, which stays
far faster for logic, permissions, and repository-scoping assertions.

- `playwright.config.ts` builds the app and serves it with `vite preview`, then runs
  against that production build — not the dev server, which tolerates things production
  does not.
- Two projects: `desktop-chromium` (standard viewport) and `mobile-chromium` (`Pixel 7`
  device profile, a **true** mobile viewport — unlike the `--window-size` flag used for
  the manual screenshot passes below, which macOS silently floors to a wider minimum).
  `*.mobile.spec.ts` files run only under `mobile-chromium`.
- Only the Chromium browser binary is installed (`npx playwright install chromium`).
  Device presets that default to WebKit (the iOS ones) will fail to launch until that
  binary is also installed — `mobile-chromium` deliberately uses `Pixel 7`, a Chromium
  device, to avoid that.
- `e2e/fixtures.ts` logs in through the **real login form** with the demo credentials
  from `src/lib/mock-data.ts` — it does not seed `localStorage` directly, unlike the
  Vitest suite, because exercising the actual form is the point of a browser test.
- Coverage: full auth flow (invalid credentials, empty-field errors, password
  visibility, logout), every sidebar link and dashboard quick action for both roles,
  Supervisor scope refusal (no Add Machine control, Officer-only report refused),
  the theme toggle including OS `prefers-color-scheme`, no-flash-of-wrong-theme on
  reload, mobile-viewport overflow checks for every shell page, and three visual
  regression snapshots of shell chrome (`e2e/*.spec.ts-snapshots/`).
- Two locator bugs were found and fixed while writing these tests, both from
  Playwright's substring-matching `getByRole`/`getByLabel`: `'Password'` matched the
  "Show/Hide password" button's `aria-label`, and `'Primary'` matched the mobile
  drawer's `'Primary (mobile)'` label. Both now use `{ exact: true }`.
- Visual snapshots are platform-specific (`-darwin.png`). Regenerate with
  `pnpm e2e --update-snapshots` after an intentional shell-chrome change; do not
  regenerate to make a real regression disappear.

## Routes

Every route below is registered in `src/lib/routes.ts` and asserted by
`src/lib/routes.test.ts`. `plannedRoutes` is empty: nothing is a placeholder.

**Public** (no session; `AppShell` lets these through)

- `/login`, `/forgot-password`, `/reset-password`

**Authenticated**

- `/` → redirects to `/dashboard`
- `/departments` — Officer department selection
- `/dashboard`
- `/machines`, `/machines/add`, `/machines/:id`, `/machines/:id/edit`
- `/parts`, `/parts/add`, `/parts/:id`, `/parts/:id/edit`
- `/maintenance`, `/maintenance/add`, `/maintenance/:id`, `/maintenance/:id/edit`,
  `/maintenance/plans/add`, `/maintenance/plans/:id/edit`
- `/repairs`, `/repairs/add`, `/repairs/:id`, `/repairs/:id/edit`
- `/reports`, `/notifications`, `/profile`, `/unauthorized`
- anything else → not-found page

Static routes are registered before their dynamic siblings so `/machines/add` is not read
as machine id `add`. `routes.test.ts` locks that ordering.

## Architecture

### Department scope is the primary axis

`AccessScope` (`src/lib/types.ts`) carries a department allow-list plus archived
visibility, and **the repository takes it as an argument** — a page cannot forget to
filter. Officers see their associated departments; Supervisors see exactly one and cannot
see archived records. This mirrors the RLS predicates that replace it in Phase 10.

Use the `*InScope` / `*ForDepartment` repository methods. The unscoped `listMachines`,
`getMachine`, and similar remain only for tests.

### Filters live in the URL

Every list and report keeps its filters in the query string rather than component state,
so a dashboard drill-through, a manual filter change, refresh, and back navigation always
agree. See `machineRegisterPath`, `partsPath`, `maintenancePath`, `repairsPath`, and
`reportsPath` in `src/lib/routes.ts`.

### Derived, never stored

These are computed on read. Storing them would let them drift from the records they
describe, and the Supabase schema should express them as views or generated columns
rather than as columns that need synchronising:

| Value                     | Derived from                                                           | Defined in                  |
| ------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| Maintenance due state     | `scheduledDate` vs the shared 15-day window; only for open records     | `lib/maintenance-record.ts` |
| Machine due / overdue     | `nextMaintenanceDate` vs the same window                               | `lib/maintenance-window.ts` |
| Effective machine status  | Open maintenance/repair records; an open repair outranks maintenance   | `recomputeMachineStatus`    |
| Plan next-due date        | `lastCompletedDate` (or `createdAt`) plus the interval                 | `lib/maintenance-plan.ts`   |
| Part replacement state    | `fittedDate` plus `expectedLifeMonths`, same 15-day window             | `lib/part-life.ts`          |
| Notifications             | Machines, open maintenance, and open repairs in the current department | `lib/notifications.ts`      |
| Department summary counts | The scoped machine list the drill-through link resolves to             | `getDepartmentSummary`      |

`DUE_SOON_WINDOW_DAYS` is defined **once** in `lib/maintenance-window.ts`. Every surface
that says "due soon" reads it, so a count can never disagree with the list it opens.

### Stored inputs

Everything on `Machine`, `MachinePart`, `MaintenanceRecord`, `MaintenancePlan`,
`RepairRecord`, `Attachment`, and `AuditLog` that is not in the table above is a stored
input typed by a user. Note that child records denormalise `machineCode` / `machineName`
for display; the real schema must normalise these rather than copy them.

## What is mock, and what Supabase must replace

`src/lib/mock-repository.ts` is the temporary boundary — roughly 76 methods behind the
`MockRepository` interface. **Pages never import `mock-data.ts` directly**; that is
enforced by convention and verified by grep.

Replaced in Phase 11 by typed Supabase queries:

- All `list*` / `get*` reads. Scoped variants become RLS-enforced queries; the
  `AccessScope` argument disappears because the database enforces it.
- All mutations: create/update/archive/restore across machines, parts, maintenance,
  plans, and repairs, plus the named transitions (`startMaintenanceRecord`,
  `completeMaintenanceRecord`, `cancelMaintenanceRecord`, `reopenMaintenanceRecord`,
  `startRepairRecord`, `waitForRepairParts`, `completeRepairRecord`,
  `cancelRepairRecord`).
- Summary methods (`getDepartmentSummary`, `getMaintenanceSummary`, `getRepairSummary`,
  `getPartsSummary`) become security-invoker views or RPCs, not client-side reduction.
- Image methods (`setMachineImage`, `setPartImage`, `addRepairAttachment`, …) become
  Cloudinary uploads brokered by Supabase Edge Functions in Phase 12.

Other mock surfaces:

- `src/lib/mock-auth.ts` — replaced by Supabase Auth in Phase 10.
- `src/lib/password-reset.ts` — the token shape is a **preview**. Supabase issues and
  validates the real recovery token; what must survive is the five states the screen
  renders (missing, malformed, expired, used, valid).
- `src/components/shared/RoleDemo.tsx` — the role switcher is **preview only and never
  authorization**. It is removed once real accounts exist.
- Notification read state (`lib/notification-storage.ts`) is browser-local and
  per-device.

## Known preview limitations

These are deliberate and labelled on screen, not oversights:

- Report **Export** produces no file. Real PDF/Excel generation is backend work.
- No email is sent by forgot-password; the success screen offers direct links to each
  recovery-token state so the screen is reviewable.
- Login shows demo accounts. This is development-only and must not ship.
- Profile identity is read-only: role, department, position, phone, and email are all
  roster-controlled, and no screen can change your own role or department.
- There are **no loading or error states** on data reads, because the in-memory
  repository is synchronous and cannot fail. They arrive with the Supabase query layer.

## Conventions

- Shared UI states live in `src/components/shared/`: `PageHeader`, `PageSection`,
  `ListToolbar`, `SearchBar`, `Pagination`, `EmptyState`, `ErrorState`, `LoadingState`,
  `FeedbackMessage`, `ConfirmDialog`, `StatusBadge`, `ImageUploader`, `ThemeToggle`, and
  `ResponsiveRecordList`.
- **`ResponsiveRecordList` is the one responsive list layout**: a bordered scrolling
  table at `lg` and above, label/value cards below. Every record list uses it.
- `StatusBadge` renders **sentence case**. The label maps in `repair-record.ts`,
  `maintenance-record.ts`, `mock-repository.ts`, and `MachineForm.tsx` follow the same
  convention.
- Archive and restore, never hard delete. History survives.
- No cost, currency, or budget field exists anywhere in the product.
- Roles are Officer and Supervisor only. There is no Viewer and no Admin.

## Theming

Light and dark are both supported, with a third **System** preference that follows the OS.
The choice persists in `localStorage` under `sail_theme`, and an inline script in
`index.html` applies the class before first paint so the page never flashes the wrong
theme. That script duplicates the resolution logic in plain JS; `theme-storage.test.ts`
asserts the two copies stay in step.

Use theme tokens (`bg-card`, `text-muted-foreground`, `border`), never literal
`bg-white` / `slate-*` / `gray-*`. A grep for those literals should return only
`StatusBadge`, where the palette steps are deliberate.

## Testing

367 tests across 27 files. Coverage is concentrated where correctness matters:

- **Repository-level scoping proofs** — that a Supervisor cannot read another
  department's or an archived record through _any_ method, asserted against the data
  layer rather than the UI.
- **Status transitions** — every allowed and refused transition, including reopen and
  repair-over-maintenance precedence.
- **Derived-value boundaries** — the 15-day window, recurrence interval maths, part life.
- **Routes** — registration, static-before-dynamic ordering, and path builders.
- **Accessibility** — one `h1` per page, shell landmarks, skip link, `aria-current`,
  keyboard operation of filters and dialogs, focus trapping and restoration.

Not covered: real pixel layout. jsdom has no layout engine, so tests prove both
responsive branches exist and carry the right data, not that either one looks right.
Playwright is listed in the Phase 7 roadmap and has **not** been added.
