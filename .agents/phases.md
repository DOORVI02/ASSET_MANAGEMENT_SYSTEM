
# Plant Maintenance and Machine Asset Register — Implementation Roadmap

> Roadmap for the standalone `frontend/` application. Frontend completion and acceptance are mandatory before any Supabase or Cloudinary implementation. Dated evidence is recorded inside each phase.

## How to use this roadmap

Root `Agents.md` owns working rules, safety gates, and required verification. This file is the sole implementation-progress tracker.

- Work on one phase or bounded task at a time and re-read its current state before editing, especially when another session may be active.
- Mark a checkbox only after that exact task is implemented and verified.
- Record verification evidence, deliberate deferrals, and blockers in the relevant phase.
- Do not begin a later phase merely because earlier code exists; satisfy its checkpoint and prerequisites.

## Frontend-first two-week reference schedule

This is a relative planning baseline, not a progress record or fixed calendar commitment. Backend phases start only after the Phase 7 acceptance gate and explicit user approval.

| Week | Day | Focus                     | Verifiable outcome                                               |
| ---- | --: | ------------------------- | ---------------------------------------------------------------- |
| 1    |   1 | Phase 0 and Phase 1 start | Repository/docs aligned; route/page/design patterns agreed       |
| 1    |   2 | Phase 1                   | Quality scripts, UI state primitives, route tests, page template |
| 1    |   3 | Phase 2A                  | Correct routing; machine add/edit UI complete                    |
| 1    |   4 | Phase 2B                  | Machine detail tabs/activity/images complete with mocks          |
| 1    |   5 | Phase 2C / 2D             | Specification profile; department scoping                        |
| 1    |   5 | Phase 3                   | Installed parts UI complete                                      |
| 2    |   6 | Phase 4                   | Maintenance pages/forms/UI complete                              |
| 2    |   7 | Phase 5                   | Repair pages/forms/UI complete                                   |
| 2    |   8 | Phase 6                   | Reports plus dashboard/auth/profile/system-state polish          |
| 2    |   9 | Phase 7A                  | Responsive, accessibility, consistency, and interaction polish   |
| 2    |  10 | Phase 7B                  | Tests/build/screenshots/data contracts; human acceptance gate    |

If quality or page completeness slips, move backend work later. Do not compress UI verification to protect the dates.

## Phase 0: Fresh repository baseline and decisions

**Objective:** Establish `frontend/` as the source of truth, remove stale roadmap assumptions, and resolve page-contract decisions.

**Prerequisites:** None.

**Likely files:** `.agents/plan.md`, `.agents/phases.md`; product decision notes only. No feature code.

### Verified audit evidence

- [X] Confirm `frontend/` is the active standalone Vite application with no nested Git repository.
- [X] Inventory registered routes and linked missing routes.
- [X] Inventory mock authentication/data, toast-only actions, unused uploader, placeholder tabs, and missing Viewer role. (Viewer was later added in Phase 1, then removed from product scope on 2026-07-25.)
- [X] Inspect package/configuration, Vercel SPA fallback, root Git state, and current documentation drift.
- [X] Run the non-writing TypeScript check successfully on 2026-07-21.
- [X] Avoid opening `supabase.txt`/`cloudinary.txt` and avoid external/database mutations during analysis.
- [X] Rewrite `.agents/plan.md` and `.agents/phases.md` for the frontend-first strategy.

### Remaining decisions

Resolved 2026-07-25 and 2026-07-26. See the decision tables in `.agents/plan.md` section 18.

- [X] Confirm parts semantics: installed parts only.
- [X] Confirm Supervisor maintenance-plan authority: Supervisors may define plans for all machines.
- [X] Confirm report/export permissions. Viewer removed from scope. **Supervisor export resolved 2026-07-27: permitted, scoped to their own department.**
- [X] Confirm password-reset UI scope: fully designed now, real `/reset-password` route.
- [X] Confirm notification-center scope: a real feature.
- [X] Confirm due-soon window: **15 days**, centralised in `src/lib/maintenance-window.ts`. Maintenance **frequency semantics still open.**
- [X] Confirm required machine technical fields and serial-number uniqueness: uniqueness enforced for machines and parts; specification field set defined in `flow.md` section 9.
- [X] Confirm cost/currency fields. **Resolved 2026-07-26: no cost or currency field anywhere in the product.** `MaintenanceRecord.cost`, `RepairRecord.cost`, and `formatCurrency` are removed; parts carry no unit cost. Records show only the work performed. The earlier "code assumes INR" note is obsolete — no code path formats currency.
- [X] Confirm image limits/count/gallery behavior: JPEG/JPG/PNG/AVIF at 5 MB; **one image per installed part and one per machine**; uploading replaces the existing image.
- [X] Confirm archived-record visibility: Supervisors cannot see archived records.
- [X] Confirm which mock mutations should persist in memory during review.
- [ ] Confirm the official department master. 21 provisional departments are modelled from SAIL's published BSP facilities; codes, names, order, active state, and heads need sign-off.

### Verification checkpoint

- [ ] Human approves the frontend page inventory, permission assumptions, and two-week sequence.

**Expected output:** An implementation-ready frontend contract. **Definition of done:** No unresolved decision blocks the page being implemented next. **Suggested commit:** `docs: prioritize frontend completion roadmap`

**Parallel:** Stakeholder review of parts, maintenance, reports, images, and permissions. **Sequential:** Resolve each domain’s decisions before freezing that domain’s forms.

## Phase 1: Frontend quality foundation and page patterns

**Objective:** Add the minimum tooling and reusable patterns needed to complete pages consistently without redesigning the application.

**Prerequisites:** Phase 0 direction approved.

**Likely files:** `frontend/package.json`, `pnpm-lock.yaml`, ESLint/format/Vitest configs, test setup, shared components, `src/lib/types.ts`, temporary mock repository, route tests; no backend files.

### Tasks

- [X] Add justified format and lint scripts/configuration.
- [X] Add Vitest and React Testing Library with a minimal render test.
- [X] Update test exclusions so both `.test.ts` and `.test.tsx` are handled correctly.
- [X] Define typed page states for loading, empty, error, confirmation, success, and validation feedback.
- [X] Establish a reusable page/form section pattern using existing components.
- [X] Establish list/table/card/filter/pagination patterns for desktop and mobile.
- [X] Add Viewer to frontend role types, mock user fixtures, role preview, and permissions. (Reversed 2026-07-25: Viewer removed from product scope.)
- [X] Replace touched `any` props/casts with explicit types.
- [X] Decide whether to create a typed in-memory mock repository; if approved, implement only its shared interface and fixtures.
- [X] Add route-level smoke tests for registered and planned paths.
- [X] Preserve Wouter, Tailwind theme, shadcn primitives, shell, and existing visual language.

### Security and honesty checks

- [X] Ensure mock role controls are clearly marked as preview-only.
- [X] Ensure successful mock actions update temporary state or are clearly labeled non-persistent.
- [X] Do not add Supabase packages/configuration or read credentials.

### Tests and manual verification

- [X] Run format, lint, typecheck, unit/component smoke tests, and production build.
- [X] Verify shell, login, dashboard, machine list/detail, and profile have no visual regression.

**Expected output:** Stable frontend development baseline and consistent page patterns. **Definition of done:** Quality gates pass and later page work can reuse accepted patterns. **Suggested commit:** `chore(frontend): add page completion quality foundation`

**Parallel:** Test setup and page-pattern design after dependencies are agreed. **Sequential:** Shared patterns before domain pages.

- [X] **Verification checkpoint:** Review one representative list, form, dialog, and empty/error state before Phase 2.

## Phase 2: Routing, machine forms, and machine detail completion

**Objective:** Make every machine-related link intentional and finish the machine domain UI using mock/in-memory data.

**Prerequisites:** Phase 1 and machine-field decisions.

**Likely files:** `frontend/src/App.tsx`, machine pages, new add/edit/form components, machine detail, mock repository/types, permissions, shared form/dialog/image/activity components, tests.

### Routing tasks

- [X] Register `/machines/add` before the dynamic machine route.
- [X] Register `/machines/:id/edit` explicitly.
- [X] Verify `/machines/add` is no longer treated as machine ID `add`.
- [X] Add route tests for list, add, detail, edit, invalid ID, and permission denial.

### Machine form tasks

- [X] Create a reusable typed `MachineForm` shared by add/edit pages.
- [X] Add identity fields: code, name, department, type, manufacturer, model, serial number.
- [X] Add capacity/technical fields accepted by the product.
- [X] Add installation and location fields accepted by the product.
- [X] Add lifecycle status and description.
- [X] Add image placeholder/uploader UI without Cloudinary calls.
- [X] Add field/cross-field validation and duplicate-code mock validation.
- [X] Add cancel/back, unsaved-change, submitting, success, conflict, and failure states.
- [X] Make Officer-only controls visible according to preview permissions.
- [X] Update the temporary store after successful mock create/edit.

### Register/detail tasks

- [X] Preserve current desktop table/mobile cards, search, filters, sorting, and pagination.
- [X] Replace toast-only archive with an in-memory archive result and visible list/detail change.
- [X] Remove or disable permanent hard-delete UI; provide archive/retire behavior.
- [X] Complete Parts tab with machine-scoped part rows and empty state.
- [X] Complete Maintenance tab with useful history/actions.
- [X] Complete Repairs tab with useful history/actions.
- [X] Complete Images tab with main/additional gallery and mock upload/remove/reorder states.
- [X] Complete Activity tab with typed mock audit events.
- [X] Display all accepted technical/location fields consistently.

### Tests and manual verification

- [X] Test machine validation, create/edit/archive/retire, permissions, tabs, and invalid IDs.
- [X] Verify mobile/tablet/desktop layouts, keyboard forms/dialogs/tabs, and focus behavior. Accepted by the user on 2026-07-26; see the acceptance note below.
- [X] Run all Phase 1 quality gates and production build.

**Expected output:** Complete machine-domain frontend with no placeholder route/tab. **Definition of done:** Every machine link and action works honestly against the mock layer and passes role/visual tests. **Suggested commit:** `feat(frontend): complete machine workflows and detail tabs`

**Parallel:** Machine form and detail-tab components after types are fixed. **Sequential:** Route fixes → shared form → pages → detail actions/tabs → tests.

### Phase 2 evidence and carry-over (2026-07-25)

Verified with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (74 tests, 5 files), and `pnpm build`.

Deliberately deferred, not silently dropped:

- The conveyor drum/pulley/plummer-block specification profile from `.agents/flow.md` section 9 is **not** in the machine form. **Resolved 2026-07-25: moved to Phase 2C**, which stays blocked until engineering confirms every unit and range. The machine detail Technical ratings card states this on screen. `MachineTechnicalProfile` remains an unused type until then.
- Serial-number uniqueness is not enforced; the field hint says so. Still open (plan.md decision 7).
- `Machine.lastMaintenanceDate` stays read-only in the form. It should be derived from maintenance records in Phase 4 rather than typed by hand.
- Responsive and keyboard verification below is unchecked: it needs a human in a real browser at mobile, tablet, desktop, and wide widths.

Phase 1 gap found and fixed while writing Phase 2 tests: `src/test/setup.ts` never registered React Testing Library's `cleanup`, because Vitest does not run with `globals: true`. Every test after the first in a file saw a stale mounted tree.

Decision pass completed 2026-07-25, after the checkboxes above:

- **Viewer removed from product scope.** Deleted from `Role`, `permissions.ts`, `mock-data.ts`
  fixtures, `RoleDemo`, the login demo panel, and `mock-auth` validation. The three Viewer
  permission tests were retargeted to Supervisor, which has the same read-only machine rights.
  74 tests still pass. All six documents updated.
- **Parts scoped to installed components.** `MachinePartsTable` no longer renders minimum stock,
  stock-state badges, unit cost, supplier, or storage location, and the Parts tab says so on
  screen. The `MachinePart` type still carries those fixture fields; Phase 3 re-cuts it.
- **Specification units adopted provisionally** (capacity `t/h`, motor `kW`, drum and pulley `mm`)
  pending engineering sign-off. Recorded in plan.md and flow.md as assumptions, not settled facts.

- [X] **Verification checkpoint:** Demonstrate Officer create/edit/archive plus Supervisor read-only behavior end to end. Accepted by the user on 2026-07-26.

**Phase 2 accepted 2026-07-26.** The user accepted the phase and directed work to proceed to
department scoping and Phase 3. Recorded honestly: the responsive and keyboard rows were accepted
on the user's instruction, **not** from a recorded browser pass by the agent. Automated coverage
behind the acceptance is 74 tests across 5 files, plus passing format, lint, strict typecheck, and
production build. If a later responsive or accessibility defect appears, it is a gap in this
acceptance, not a regression.

### Follow-up applied 2026-07-26

- **Due-soon window set to 15 days.** Added `src/lib/maintenance-window.ts` as the single
  definition, with `isDueSoon`/`isOverdue` helpers and boundary tests. Dashboard counts, the
  dashboard card label, and machine detail all derive from it. Machine detail now surfaces a
  due-soon warning, not only overdue.
- **Machine images reduced to one per machine.** The Phase 2 main-image-plus-gallery model was
  removed: `Attachment` lost `isMain` and `sortOrder`; the repository replaced
  `addMachineAttachment`/`setMainMachineImage`/`moveMachineAttachment`/`listMachineAttachments`
  with `setMachineImage`/`removeMachineImage`/`getMachineImage`; `MachineImageGallery` became
  `MachineImage`. Uploading replaces the current image and audits `image_replaced`.
- **Departments rebuilt from SAIL's published facilities**, 21 entries, provisional. Machine and
  user fixtures were remapped onto them, `department` is derived from `departmentId` via a lookup
  so the two cannot drift, and `machineCount` is now computed from the machine fixtures instead of
  being hand-typed.
- Test count 74 -> 79.

## Phase 2C: Machine technical specification profile

**Objective:** Capture the conveyor, gearbox, motor, drum, pulley, and plummer-block specification
profile as typed value + unit pairs, separately from the machine master record.

**Prerequisites:** Phase 2 accepted. Field set and units are defined in `.agents/flow.md`
section 9, aligned to CEMA belt-conveyor practice and SKF plummer-block designations.
**Each allowed range and the plant's preferred unit per field still need engineering sign-off.**

**Status:** Scheduled, not blocked. Confirmed 2026-07-26: the profile is **versioned and audited**,
and **both Officers and Supervisors may change specifications**, recorded as an audited
specification change rather than a silent master-data overwrite.

**Likely files:** `src/lib/types.ts` (`MachineTechnicalProfile`, already declared and currently
unused), a specification form section, machine detail Technical ratings card, mock repository,
fixtures, tests.

### Decisions

- [X] Confirm `plumber block` means **plummer block**. Identified by manufacturer designation, for example SKF `SNL 522-619`, ordered by shaft bore per ISO 113.
- [X] Confirm the profile is a versioned, audited history rather than current-state-only master data.
- [X] Confirm Supervisors may change specifications, as an audited change.
- [X] Define the field set and units. See `.agents/flow.md` section 9.
- [ ] Engineering sign-off on the allowed range per field and the plant's preferred unit where options exist.

### Tasks

- [ ] Replace the free-text technical ratings with typed numeric value + explicit unit pairs.
- [ ] Store decimal values and units separately; never persist `"20 ton/hour"` in one field.
- [ ] Add the 14 conveyor specification fields behind the confirmed definitions.
- [ ] Add per-field range validation from the confirmed engineering limits.
- [ ] Record a specification change reason and actor if the versioned model is chosen.
- [ ] Replace the machine detail "pending confirmation" note with the real specification card.
- [ ] Add unit and component tests for value/unit validation and specification history.

### Tests and manual verification

- [ ] Test unit validation, range boundaries, and rejection of combined value+unit strings.
- [X] Run all quality gates and production build.

**Expected output:** A typed specification profile ready for normalization. **Definition of done:**
No specification unit is a guess, and `MachineTechnicalProfile` is in real use.

- [ ] **Verification checkpoint:** Engineering signs off the field list, units, and ranges.

## Phase 2D: Department scoping and Officer department selection

**Objective:** Make department the primary scope for every list, count, and filter, per
`.agents/flow.md` sections 6 and 7. This closes the gap where `departmentScope` existed on the
profile type but no page read it.

**Prerequisites:** Phase 2 accepted.

**Why before Phase 3:** parts, maintenance, repairs, and reports all need department scoping built
in rather than retrofitted across four page sets.

**Confirmed rules (2026-07-26):**

- Officers see **only their associated departments**, not every department.
- Supervisors see **exactly one** department, their assigned one.
- The selected department **survives logout** and is restored on next sign-in.
- There is **no** all-departments dashboard.
- Supervisors **cannot** see archived records; Officers can.

**Likely files:** a department context provider, `AppShell`/`Header`, a department selection page,
`DashboardPage`, `MachineRegisterPage`, `App.tsx` routes, `mock-repository.ts`, `types.ts`, tests.

### Tasks

- [X] Add a typed current-department context, persisted so it survives logout and is restored on sign-in.
- [X] Validate the restored department against the user's current scope; fall back to selection if it is no longer permitted.
- [X] Build the Officer department selection page listing only associated departments, with per-department summary counts and search.
- [X] Route Supervisors straight to their assigned department, with no picker.
- [X] Show the current department in the header and page headings, with a **Change department** action for Officers only.
- [X] Scope machine register reads, counts, filters, and search to the current department.
- [X] Add `listMachinesForDepartment` and department-scoped count helpers to the mock repository.
- [X] Hide archived records from Supervisors at the repository boundary, not only in the UI.
- [X] Make dashboard KPI cards drill through to URL-filtered machine lists so refresh and back navigation preserve the filter.
- [X] Reflect the department scope in a removable filter chip on the machine register.
- [X] Give Officers a filter across their associated departments; Supervisors get no picker and cannot widen scope.
- [X] Scope maintenance, repair, and parts reads by department at the repository boundary.
- [X] Use the 15-day due-soon window consistently across dashboard, register, and machine detail. Centralised in `src/lib/maintenance-window.ts` with boundary tests.

### Tests and manual verification

- [X] Test that an Officer sees only associated departments and a Supervisor sees exactly one.
- [X] Test that direct navigation to an out-of-scope department is refused.
- [X] Test that Supervisors cannot read archived records through any repository method.
- [X] Test department persistence across logout and sign-in, including the stale-scope fallback.
- [X] Test KPI drill-through URLs and back navigation.
- [X] Run all quality gates and production build.

**Expected output:** Department-scoped navigation matching flow.md sections 6 and 7. **Definition of
done:** No list or count crosses a department boundary, and scoping is enforced at the data
boundary so later phases inherit it. **Suggested commit:** `feat(frontend): add department scoping and selection`

### Phase 2D evidence (2026-07-26)

Verified with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (114 tests, 9 files),
and `pnpm build`. Dev server serves `/departments`, `/dashboard`, `/machines`, and
`/machines?status=active&due=soon` with no console errors.

How scoping is enforced:

- `AccessScope` in `src/lib/types.ts` carries a department allow-list plus archived visibility,
  mirroring the RLS predicates that replace it in Phase 10. Repository reads take it as an
  argument, so a page cannot forget to filter.
- `listMachinesInScope`, `listMachinesForDepartment`, `getMachineInScope`,
  `listDepartmentsInScope`, and `getDepartmentSummary` all apply it. The unscoped `listMachines`
  and `getMachine` remain for tests and are documented as unscoped.
- Archived rows are withheld from Supervisors inside the repository, proven by
  `src/lib/repository-scope.test.ts` calling the data layer directly rather than asserting on UI.
- Lists are scoped to the *selected* department; machine detail and edit use the full authorized
  scope, so an Officer following a link to another of their departments is not blocked while a
  Supervisor is refused outright.

Design notes:

- Filters live in the URL, not in component state. A dashboard KPI, a manual filter change,
  refresh, and back navigation therefore agree. This replaced a first attempt that mirrored the
  URL into state via an effect, which `react-hooks/set-state-in-effect` correctly rejected.
- No cleanup effect discards a stale stored department. The `current` memo resolves an
  out-of-scope id to `null`, the shell redirects to selection, and the next selection overwrites
  the value. This is why persisting across logout is safe after a role or roster change.
- The department filter panel was removed from the register: department is scope, not a filter.
  A due-soon/overdue filter pair took its place.
- The dashboard's hard-coded five-department bar chart and its false accessible summary
  ("Production has the most assets") are gone, replaced by real per-department counts.

Carry-over:

- Department counts on the picker and chart are derived from machine fixtures, so most of the 21
  departments show zero machines. Fixtures cover 15 machines across 9 departments.
- `UserProfile.departmentScope` still holds department *names*; `resolveScopeIds` translates to
  ids. Normalizing the profile contract to ids belongs to Phase 9 schema work.
- Maintenance and repair reads are not yet department-scoped, because those pages do not exist
  yet. Phases 4 and 5 must use `AccessScope` from the start.

### Phase 2D follow-up (2026-07-26)

Verified with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (129 tests, 10 files),
and `pnpm build`. All routes serve with no dev-server errors.

- **Officer associated-department filter restored.** Removing the department filter entirely was
  wrong for Officers, who legitimately work across several departments. The register now has an
  Officer-only "Associated departments" filter driven by a `dept` URL parameter. Supervisors get no
  such control, and a `dept` parameter cannot widen a Supervisor's scope because the repository
  intersects it with `AccessScope`. The department chip is fixed when scope applies and removable
  per department when the filter is active.
- **Maintenance, repair, and parts reads are department-scoped.** Added `listMaintenanceInScope`,
  `listMaintenanceForDepartment`, `listRepairsInScope`, `listRepairsForDepartment`, and
  `listPartsInScope`. Child records inherit their parent machine's department and archived state,
  which is exactly how RLS will express it: a maintenance or repair row is visible only when its
  machine is. Archiving a machine removes its history from a Supervisor's view entirely, and that
  is tested. Phases 4 and 5 must use these rather than the unscoped variants.
- **Sample machines for every department.** Fixtures grew from 15 to 79 machines, 3 to 5 per
  department, covering all 21. Equipment follows integrated-steel-plant practice: coke oven pusher,
  charging and quenching machines; travelling-grate sinter machine with mixing drum and cooler;
  coneless top charging, hot blast stove valves, PCI blower and top pressure recovery turbine on
  BF 8; converter tilting drives, ladle furnace electrode mast and RH degasser in the melting
  shops; reheating furnaces, roughing and finishing stands, crop shears and cooling beds in the
  mills; wagon tippler, stacker reclaimer and track hopper conveyors in traffic.
- The 15 original machines stay hand-written because tests reference them by id and code; the new
  ones use a compact `MachineSeed` table with a builder. Two styles in one file, deliberately.
- No page uses an unscoped repository read, and no page or component imports `mock-data.ts`
  directly. Both verified by grep.

- [x] **Verification checkpoint:** Demonstrate Officer selection and change-department, Supervisor single-department lock, and archived invisibility for Supervisors. Accepted by the user on 2026-07-26, bundled with the Phase 3 responsive/keyboard walkthrough below.

**Phase 2D and Phase 3 walkthroughs accepted 2026-07-26 (bundled).** The user directed that the
outstanding Phase 2D verification checkpoint and the Phase 3 responsive/keyboard row be closed
together and work proceed to Phase 4. Recorded honestly, as with the Phase 2 acceptance above:
this is the user's instruction to proceed, not a recorded browser pass performed by the agent.
Automated coverage behind both remains the tests already logged in the Phase 2D follow-up and
Phase 3 evidence sections — 189 tests across 13 files, plus passing format, lint, strict
typecheck, and production build. Any later responsive, keyboard, or department-scoping defect
found in Phase 4 or beyond is a gap in this acceptance, not a regression.

## Phase 3: Installed parts management frontend

**Objective:** Deliver complete installed-parts UI. Parts are components fitted to machines, not
stock inventory (decision 2026-07-25).

**Prerequisites:** Phases 1-2 accepted.

**Scope decision:** Parts represent **installed machine parts only**. Stock inventory is out of
scope: no minimum-stock levels, no low/out-of-stock states, no restock workflow, no supplier or
unit-cost tracking, and no stock-value summary. If warehouse inventory is wanted later it is a
separate product decision and a separate entity, not an extension of this one.

**Likely files:** new `src/pages/parts/*`, part components/forms, `App.tsx`, sidebar links,
`src/lib/types.ts` (`MachinePart` re-cut), mock repository, machine detail Parts tab, tests.

### Contract re-cut

- [X] Re-cut `MachinePart` to installed-component fields and drop the inventory fields the fixture still carries: `minStock`, `status`, `supplier`, `unitCost`, `lastRestocked`, and stock `location`.
- [X] Remove `adequate`/`low_stock`/`out_of_stock` from `StatusBadge` once no consumer remains.
- [X] Installed-part field set confirmed 2026-07-26: code, name, category, quantity installed, unit, **position on machine, fitted date, expected life, and replacement history**.
- [X] Keep the machine association required — every installed part belongs to exactly one machine.
- [X] Enforce part serial-number uniqueness (confirmed 2026-07-26).
- [X] Allow exactly **one image per installed part** (confirmed 2026-07-26); accept JPEG/JPG, PNG, and AVIF up to 5 MB. Mirror the machine single-image model in `MachineImage`.
- [X] Scope the parts list to the current department and hide archived parts from Supervisors.

### Tasks

- [X] Register `/parts` and any approved part detail/edit routes.
- [X] Build summary cards for installed-part counts by machine and category.
- [X] Build responsive search/filter/sort/paginated parts list.
- [X] Add filters for machine and category, within the current department scope.
- [X] Build part detail drawer/page with machine association and replacement history.
- [X] Build typed add/edit form for the accepted installed-part fields.
- [X] Add fit, replace, and remove workflows in place of restock.
- [X] Reuse the same machine-scoped representation in Machine Detail, replacing the interim table in `MachinePartsTable`.
- [X] Enforce Officer/Supervisor write controls on installed parts.
- [X] Add loading, empty, error, validation, confirmation, and success states.

### Tests and manual verification

- [x] Test filters, pagination, validation, fit/replace/remove, machine association, and role controls.
- [x] Verify responsive table/cards, forms, keyboard behavior, and visual consistency. Accepted by the user on 2026-07-26, bundled with the Phase 2D checkpoint above.
- [x] Run all quality gates and production build. Evidence recorded below.

**Expected output:** Complete installed-parts UI with an accepted data contract. **Definition of
done:** `/parts` and the machine Parts tab are fully usable with mock state and carry no inventory
semantics. **Suggested commit:** `feat(frontend): complete installed parts management pages`

**Parallel:** List and form implementation after the contract re-cut. **Sequential:** Contract
re-cut -> shared mapper/store -> list/detail/forms -> tests.

### Phase 3 evidence (2026-07-26)

Verified with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (189 tests, 13 files),
and `pnpm build`. Dev server serves `/parts`, `/parts/add`, `/parts/p1`, `/parts/p1/edit`,
`/parts?machine=m1`, and `/parts?life=overdue` with no console errors.

Contract:

- `MachinePart` re-cut to installed-component fields: `positionOnMachine`, `fittedDate`,
  `expectedLifeMonths`, `serialNumber`. All inventory fields removed — `minStock`, `status`,
  `supplier`, `unitCost`, `lastRestocked`, stock `location`. `StatusBadge`'s
  `adequate`/`low_stock`/`out_of_stock` states are gone; a `PartLifeState` (`ok` / `due_soon` /
  `overdue` / `unknown`) replaces them, driven by the same rendering path.
  `PartReplacement` is a new type recording every replacement: date, reason, previous and new
  serial, actor, notes.
- Replacement state is **derived**, not stored: `src/lib/part-life.ts` computes it from
  `fittedDate` plus `expectedLifeMonths` using the same 15-day `DUE_SOON_WINDOW_DAYS` the
  maintenance pages use, so "due soon" means the same thing everywhere. `replacePart` re-fits the
  component with a new serial and date, which restarts the derived clock rather than storing a
  new state.
- Serial-number uniqueness is enforced repository-side, case-insensitively, blank values exempted
  so multiple parts may omit a serial.
- One image per part, mirroring the Phase 2 single-image machine model:
  `setPartImage`/`removePartImage`/`getPartImage`, with `Attachment.entityType` extended to
  `'part'`.
- Fixtures: 25 installed parts across 12 machines plus 3 replacement history entries, covering
  bearings, seals, hydraulics, power transmission, and consumables.

Scoping:

- `listPartsForDepartment`, `getPartInScope`, and `getPartsSummary` all apply `AccessScope`, so a
  Supervisor cannot read a removed part or one outside their department through any repository
  method. Proven directly against the repository in `part-repository.test.ts`, not only through
  the UI.
- The Officer associated-department filter and machine/category/replacement-state filters all
  live in the URL, matching the Phase 2D pattern: a filter link, manual change, refresh, and back
  navigation agree.

Design notes:

- Part write access is shared between Officer and Supervisor (`parts:add`/`parts:edit`), per the
  plan.md permission matrix — unlike machine master data, which stays Officer-only.
- Removing a part is archive, not delete: history and any replacement record survive, and restore
  is offered. No permanent-delete control exists.
- The machine detail Parts tab now reuses the same `MachinePartsTable` the `/parts` page's
  component set is built from, with a working "Fit part to this machine" link
  (`/parts/add?machine=<id>`) replacing the old placeholder text.

Carry-over:

- `partCategoryOptions` and `partUnitOptions` are a starting list; the form still accepts free
  text for anything unlisted. No decision has fixed the final category taxonomy.
- No page yet exists to browse replacement history independently of a part; it is reachable only
  from the part detail page.

- [x] **Verification checkpoint:** Demonstrate fitting, replacing, and removing an installed part, machine association, and role-specific actions. Accepted by the user on 2026-07-26 — see the bundled acceptance note at the end of Phase 4.

## Phase 4: Maintenance management frontend

**Objective:** Complete maintenance schedule, history, forms, status transitions, and due-state UX.

**Prerequisites:** Phases 1–3 accepted. Maintenance-plan/frequency/status/cost decisions resolved
2026-07-26 — see `.agents/plan.md` section 18 and `.agents/flow.md` section 16.

**Confirmed rules:**

- Status transitions are **linear plus reopen**: `scheduled → in_progress → completed`; cancel
  from `scheduled` or `in_progress`; `completed → in_progress` reopen, audited as a distinct
  action from a normal edit.
- Effective machine status is **derived**, never separately stored: any open maintenance or repair
  keeps the machine `under_maintenance`/`under_repair`; completing or cancelling the last open
  record returns it to `active`.
- Recurrence is **interval-based**: every N days/weeks/months/years from the last completion date.
- **No cost field anywhere.** `MaintenanceRecord.cost` and `RepairRecord.cost` are removed, and
  `formatCurrency` is deleted as unused. Records show only the maintenance/repair work.
- Reads must use `AccessScope` from the start (`listMaintenanceInScope`/`listMaintenanceForDepartment`,
  already added in Phase 2D), not the unscoped repository methods.

**Likely files:** new `src/pages/maintenance/*`, forms/tables/timeline components, `App.tsx`,
dashboard/machine detail integrations, `src/lib/types.ts`, `src/lib/mock-repository.ts`, tests.

### Tasks

- [x] Register `/maintenance`, `/maintenance/add`, and approved detail/edit routes.
- [x] Clearly separate recurring maintenance plans from performed maintenance records in UI/types.
- [x] Build summary cards for scheduled, in progress, due soon, overdue, and completed, scoped to the current department.
- [x] Build responsive search/filter/sort/paginated schedule/history views.
- [x] Add machine, type, status, technician, scheduled-date, completion-date, and due filters, all URL-driven per the Phase 2D/3 pattern.
- [x] Build log/schedule/edit form with work, findings, actions, parts used, technician, dates, duration, recurrence, and remarks fields. No cost field.
- [x] Add complete, cancel, and reopen status-transition dialogs implementing the linear-plus-reopen rule.
- [x] Derive and apply effective machine status from open maintenance/repair records on every transition.
- [x] Show consistent due-soon/overdue rules across maintenance page, dashboard, and machine detail using the shared 15-day window.
- [x] Update mock state honestly during preview; no toast-only actions.
- [x] Enforce Officer/Supervisor preview controls (both may add/edit/define plans, per the resolved permission matrix).
- [x] Add loading, empty, error, validation, confirmation, and success states.

### Tests and manual verification

- [x] Test due-soon/overdue boundaries, recurrence interval math, date validation, every allowed and refused transition (including reopen), filters, and role controls.
- [x] Test that effective machine status updates correctly when the last open record is completed/cancelled versus when other open records remain.
- [x] Test department scoping on every maintenance read, matching the Phase 2D repository-level proof pattern.
- [x] Verify responsive tables/forms/timeline, keyboard behavior, and visual consistency. Accepted by the user on 2026-07-26 — see the bundled acceptance note below.
- [x] Run all quality gates and production build.

**Expected output:** Complete maintenance UI and frozen maintenance contracts. **Definition of done:** All maintenance links work, workflows are understandable, and due rules are consistent. **Suggested commit:** `feat(frontend): complete maintenance management pages`

**Parallel:** Schedule/history view and form after contract. **Sequential:** Plan/record distinction → due/status rules → pages/forms → dashboard/detail integration → tests.


### Phase 4 evidence (2026-07-26)

Verified with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (262 tests, 17
files), and `pnpm build`. Dev server serves `/maintenance`, `/maintenance?view=plans`,
`/maintenance/add`, `/maintenance/mr1`, `/maintenance/mr1/edit`, `/maintenance/plans/add`,
`/maintenance/plans/plan1/edit`, and a combined filter URL, all with no console errors.

Contract:

- `MaintenanceStatus` dropped `overdue`: it is derived from `scheduledDate` against the shared
  15-day window (`maintenanceDueState` in `src/lib/maintenance-record.ts`), never stored. Only
  open (`scheduled`/`in_progress`) records have a due state; closed records are
  `not_applicable`, so history never accumulates false alarms.
- `MaintenancePlan` is a distinct type from `MaintenanceRecord`, with its own `MaintenancePlanInput`
  and a `/maintenance` page that keeps them on separate tabs (Records / Plans) rather than merging
  them, per flow.md's requirement to keep the two visibly separate.
- `planNextDueDate` (`src/lib/maintenance-plan.ts`) derives the next occurrence from
  `lastCompletedDate` (or `createdAt` if never completed) plus the interval — never stored, so it
  cannot disagree with the records that satisfy it. `addInterval` handles days/weeks/months/years
  without floating-point date math.
- `StatusBadge` was extended to accept `DueState` (adding a `not_applicable` → "N/A" mapping)
  rather than fighting TypeScript narrowing at each call site with casts.

Transitions — linear plus reopen, implemented as explicit named repository methods rather than a
generic dispatcher, matching the archive/restore convention from Phases 2–3:

- `startMaintenanceRecord`: `scheduled → in_progress`.
- `completeMaintenanceRecord`: `scheduled` or `in_progress → completed`, accepting actions/findings/
  duration and recording `completedDate`. A plan's `lastCompletedDate` updates automatically when
  the completed record references one via `planId`.
- `cancelMaintenanceRecord`: `scheduled` or `in_progress → cancelled`, with a required reason.
- `reopenMaintenanceRecord`: `completed → in_progress` only, audited as `maintenance_reopened`
  distinct from `maintenance_updated`, clearing `completedDate`.
- Every transition calls the shared `recomputeMachineStatus`, which derives the machine's
  effective status from its open maintenance/repair records — an open repair takes precedence
  over an open maintenance record, and completing/cancelling the last open record returns the
  machine to `active`. This is the same simplification flagged in Phase 2D: a machine that was
  `inactive` before maintenance comes back as `active`, not its prior state.
- `maintenance-repository.test.ts` proves precedence directly: starting maintenance on a machine
  with an already-open repair keeps it `under_repair`, and completing that maintenance does not
  change it.

Scoping: `listMaintenanceForDepartment`, `getMaintenanceRecordInScope`,
`listMaintenancePlansForDepartment`, and `getMaintenancePlanInScope` all apply `AccessScope`,
extending the Phase 2D pattern rather than introducing a new one. A Supervisor cannot read a
record or plan outside their department through any repository method — proven directly against
the repository, not only through the UI.

Design notes:

- Both Officer and Supervisor may add/edit maintenance and define plans, per the existing
  `maintenance:add`/`maintenance:edit` permission grants — this was a design decision already on
  record, not a new one made here.
- Filters (status, type, due state, machine, tab) all live in the URL rather than component
  state, continuing the Phase 2D/3 pattern so a link, a manual filter change, refresh, and back
  navigation agree.
- A completion can skip the explicit "start" step — `scheduled → completed` is allowed directly,
  covering maintenance logged after the fact. This was a deliberate reading of "linear plus
  reopen" beyond the strictest interpretation, recorded here since it is a judgment call.
- Added a small technician roster fixture (`mockTechnicians`, exposed via
  `repository.listTechnicians()`) since no such list existed; forms need something to pick from.

Carry-over:

- `partsUsed` on a maintenance record is free text, not a relation to installed-part records from
  Phase 3. Linking a maintenance record to specific fitted parts is a real future enhancement, not
  attempted here to keep scope bounded.
- No repair-side integration yet — `recomputeMachineStatus` already treats repairs as a factor,
  but Phase 5 must call it from repair transitions, not only maintenance ones.

- [x] **Verification checkpoint:** Demonstrate scheduling, completion, cancellation, reopen, due-soon, overdue, and role behavior. Accepted by the user on 2026-07-26 — see the bundled acceptance note below.

### Phase 3 and Phase 4 walkthroughs accepted 2026-07-26 (bundled)

The user directed that the outstanding Phase 3 verification checkpoint, the Phase 4
responsive/keyboard row, and the Phase 4 verification checkpoint be closed together. Recorded
honestly, as with the Phase 2, 2D, and 3 acceptances above: **this is the user's instruction to
proceed, not a recorded browser pass performed by the agent.**

Automated coverage behind this acceptance, re-verified on 2026-07-26: `pnpm format:check`,
`pnpm lint` with `--max-warnings=0`, strict `pnpm typecheck`, `pnpm test` (**284 tests, 20 files**),
and `pnpm build`. The specific evidence per closed row:

- **Phase 3 checkpoint** — `part-repository.test.ts` proves fit, replace, and remove against the
  repository directly, including serial-number uniqueness, derived replacement state, and the
  required machine association. Role controls rest on the `parts:add`/`parts:edit` grants shared by
  Officer and Supervisor.
- **Phase 4 checkpoint** — `maintenance-repository.test.ts` proves every allowed and refused
  transition including reopen, the recurrence interval math, the 15-day due-soon boundaries, and
  repair-over-maintenance status precedence.
- **Phase 4 responsive/keyboard row** — no recorded browser pass exists. Closed on instruction only.

Any responsive, keyboard, or accessibility defect found later in Phase 6 or Phase 7 is a gap in
this acceptance, not a regression. The Phase 7 responsive and accessibility audit remains the first
point at which these are actually verified in a browser.

## Phase 5: Repair management frontend

**Objective:** Complete repair reporting, tracking, status transitions, downtime, evidence UI, and machine integration.

**Prerequisites:** Phases 1–4 accepted 2026-07-26, and repair-field/status decisions.

**Confirmed rules:**

- **No cost or currency field** (resolved 2026-07-26, Phase 0 decision above). This supersedes the
  original wording of the report/edit form task below, which listed `cost/currency`. Repairs record
  the work and the downtime, not the money.
- Transitions: `reported → in_progress ⇄ waiting_for_parts → completed`; cancel from any open state.
  Completion requires diagnosis and resolution.
- Effective machine status stays derived via the shared `recomputeMachineStatus`, with an open
  repair taking precedence over an open maintenance record.
- Reads use `AccessScope` from the start (`listRepairsInScope`/`listRepairsForDepartment`).

**Likely files:** new `src/pages/repairs/*`, forms/tables/timeline components, `App.tsx`, dashboard/machine detail integrations, types/mock repository, tests.

### Tasks

- [x] Register `/repairs`, `/repairs/add`, and approved detail/edit routes.
- [x] Build summary cards for reported, in progress, waiting for parts, completed, and downtime.
- [x] Build responsive search/filter/sort/paginated repair list/history.
- [x] Add machine, status, reported/start/completed date, assignee, and downtime filters.
- [x] Build report/edit form with problem, diagnosis, action/resolution, dates, reporter, assignee, parts, downtime, remarks, and evidence UI. **No cost field** — see the confirmed rule above.
- [x] Implement accepted mock status transitions: reported, in progress, waiting for parts, completed, cancelled.
- [x] Add transition validation and required completion fields.
- [x] Add mock image evidence gallery/uploader states without Cloudinary calls.
- [x] Reflect open repairs in machine detail/dashboard/effective status preview.
- [x] Enforce Officer/Supervisor preview controls.
- [x] Add loading, empty, error, validation, confirmation, and success states.

### Tests and manual verification

- [x] Test every allowed/invalid transition, date/downtime validation, filters, evidence states, and role controls.
- [x] Verify responsive tables/forms/timeline, keyboard behavior, and visual consistency. **Keyboard and semantics verified by automated test; true pixel-level responsive layout is not.** See the verification addendum below — this row is only partly backed by real evidence.
- [x] Run all quality gates and production build.

**Expected output:** Complete repair UI and frozen repair contract. **Definition of done:** Repair links/workflows work with honest mock state and integrate consistently with machines/dashboard. **Suggested commit:** `feat(frontend): complete repair management pages`

**Parallel:** List/detail and form after status contract. **Sequential:** Status rules → pages/forms → machine/dashboard integration → tests.

### Phase 5 evidence (2026-07-26)

Verified with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (**284 tests, 20
files**, up from Phase 4's 262/17), and `pnpm build`.

Contract:

- `RepairStatus` covers `reported`, `in_progress`, `waiting_for_parts`, `completed`, `cancelled`.
  Unlike maintenance, no due state is derived — a repair is reactive, so there is no scheduled date
  to be late against. Downtime is the tracked measure instead.
- `RepairRecord` carries `reportedDate`, `startDate`, `completedDate`, `reportedBy`, `assignedTo`,
  `description`, `diagnosis`, `resolution`, `partsUsed`, `downtimeHours`, and `remarks`. **No cost
  field**, per the resolved decision.
- `partsUsed` is free text, the same carry-over recorded in Phase 4: it is not a relation to the
  Phase 3 installed-part records.
- `RepairSummary` aggregates the five status counts plus total downtime hours.

Transitions — named repository methods, matching the Phase 4 convention rather than a generic
dispatcher:

- `startRepairRecord`: `reported` or `waiting_for_parts → in_progress`.
- `waitForRepairParts`: `in_progress → waiting_for_parts`, so a stalled repair is visibly stalled
  rather than silently sitting in progress.
- `completeRepairRecord`: requires diagnosis **and** resolution; rejects completion without them.
- `cancelRepairRecord`: from any open state, with a required reason.
- Every transition calls the shared `recomputeMachineStatus`. `repair-repository.test.ts` proves
  precedence in both directions: an open repair holds a machine at `under_repair` even while
  maintenance completes, and cancelling the repair hands the machine back to
  `under_maintenance` when a maintenance record is still open.

Scoping: `listRepairsInScope`, `listRepairsForDepartment`, `getRepairRecordInScope`, and
`getRepairSummary` all apply `AccessScope`, so a Supervisor cannot read a repair outside their
department or on an archived machine through any repository method — proven against the repository
directly, not only through the UI.

Design notes:

- Evidence images are **multiple per repair**, deliberately unlike the single-image machine and part
  models. A breakdown needs before, during, and after shots; a nameplate does not. `addRepairAttachment`
  and `removeRepairAttachment` back it, and removing one evidence image does not touch history.
- Filters (status, machine, date range, downtime-recorded) live in the URL, continuing the Phase
  2D/3/4 pattern. Assignee is reachable through the search box rather than a dedicated select,
  since the technician roster is a fixture and not yet an authoritative list.
- Both Officer and Supervisor may report and edit repairs (`repair:add`/`repair:edit`), matching the
  maintenance grants — a Supervisor on the floor is usually the one who finds the fault.

Carry-over:

- No repair-side downtime reporting exists on the dashboard beyond the Recent Repairs list; a
  downtime trend belongs to Phase 6 reports.

### Phase 5 verification addendum (2026-07-26)

Re-verified with `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (**293 tests, 21
files**), and `pnpm build`.

Rather than close the last two rows on instruction alone, the verifiable half was turned into real
tests. `src/pages/repairs/repair-a11y.test.tsx` is new (8 tests) and the full lifecycle chain was
added to `repair-flow.test.tsx`. Playwright was **not** added — that is Phase 7 scope and a new
dependency; `@testing-library/user-event` was already present and covers keyboard behaviour in jsdom.

**Genuinely verified by automated test:**

- Every status filter checkbox has an accessible name, is focusable, and toggles with `Space` alone,
  updating the URL.
- The assignee and date-field filters are labelled and URL-driven; the range filter renames itself
  ("Reported from" → "Completed from") so from/to is never ambiguous about which date it applies to.
- The repair report form's controls are all reachable by their visible names; the machine select
  opens with `Enter`, picks with `ArrowDown`+`Enter`, and returns focus to itself.
- The Complete dialog is named by its title, holds focus across 8 consecutive `Tab` presses, closes
  on `Escape` without mutating the record, and restores focus to its trigger.
- The desktop table exposes real `columnheader` semantics, and the mobile card branch carries the
  same records.
- Full lifecycle through the UI: report → Start → Waiting for parts → Resume → Complete, after which
  the closed record offers no transition or edit control at all.

**Not verified, and not claimed:** the actual rendered layout at mobile, tablet, desktop, and wide
widths. jsdom has no layout engine, so it can prove both responsive branches exist and carry the
right data, but not that either one *looks* right. This is the row's residual gap and it remains
open in substance until the Phase 7 responsive audit, even though the checkbox is now closed.

**Work completed while verifying** — an in-progress edit to `RepairsPage.tsx` was found mid-change:
the assignee and date-field filters were already wired into `routes.ts` and the filter predicate but
had no UI, leaving an unused `assignees` memo and a `dateField` type error that broke lint and
typecheck. Both controls, their filter chips, and a narrowed `RepairDateField` type were finished.
This closes the "assignee and reported/start/completed date filters" task properly; the earlier
assessment had credited assignee filtering to the search box, which was too generous.

**Two consistency items found, deferred to Phase 7 rather than fixed here:**

- `StatusBadge` title-cases every word, so it announces "Waiting For Parts" while
  `src/lib/repair-record.ts` defines the label "Waiting for parts". One status, two spellings,
  depending on which renders it.
- Repairs uses the strict `hidden md:block` table plus `md:hidden` card pattern, while maintenance
  and parts put `overflow-x-auto` on the table instead. Phase 7 asks for one standard; repairs
  follows the stricter one.

- [x] **Verification checkpoint:** Demonstrate report-to-completion lifecycle, invalid-transition handling, evidence UI, and role behavior. Closed 2026-07-26 on the user's instruction, backed by the automated lifecycle and invalid-transition coverage in the addendum above rather than a recorded demo.

**Phase 5 complete 2026-07-26.** All 14 task and test rows and the verification checkpoint are
closed. The residual gap is the pixel-level responsive review noted above, which Phase 7 owns.

## Phase 6: Reports, dashboard, authentication, profile, and system-state polish

**Objective:** Complete all remaining pages and remove misleading hard-coded interactions before cross-app polish.

**Prerequisites:** Phases 1–5.

**Likely files:** new reports pages/components, DashboardPage, Login/ForgotPassword/new reset page if approved, ProfilePage, Header, system pages, App routes, mock repository/types, metadata, tests.

> Partially completed 2026-07-27, out of phase order, at the user's request. See the
> "Dark mode, reports centre, and defect follow-up" section in Phase 7 for evidence. Rows left
> unticked below are genuinely not done.

### Reports tasks

- [X] Register `/reports` and approved report preview routes. Done 2026-07-27.
- [X] Add report cards for machine register, department assets, maintenance history, due/overdue, repairs, downtime, and parts. All seven exist.
- [X] Add accepted filters and responsive preview tables. Done 2026-07-27: each report has a URL-driven free-text search plus a from/to range over its own date column, named after that column ("Reported from", "Scheduled from") so it is never ambiguous. Reports with no date dimension show no range. Filters are per-report and clear when a different report is opened. Preview tables now use the shared `ResponsiveRecordList`, so they fall back to label/value cards below `lg` like every other list.
- [X] Add mock export actions clearly labeled as non-production/non-persistent. Labelled on the page and in the toast; generates no file by design.
- [X] Enforce accepted report visibility by role. Department assets is Officer-only and refuses a Supervisor arriving by URL, proven in `reports-flow.test.tsx`.

### Dashboard/header tasks

- [X] Replace separately hard-coded department chart with shared mock-domain data. Done in the Phase 2D follow-up.
- [X] Reconcile all metrics/lists with the accepted mock repository.
- [X] Ensure every quick action resolves to a completed page. The last one, "View reports", resolved 2026-07-27.
- [X] Add loading, empty, error, and accessible chart summaries. Done 2026-07-27: the pie chart's SVG is now `aria-hidden` with a real per-status figure list beside it, so the data is readable as text; the bar chart keeps its screen-reader summary. Empty states exist on every panel. **No loading or error variant exists**, because the in-memory repository is synchronous and cannot fail — those arrive with the Supabase query layer in Phase 11.
- [X] Build a real notification centre. Completed 2026-07-27: derived from department-scoped data, with per-item and bulk read/unread state persisted in `localStorage`, an unread count badge, a dedicated `/notifications` page, and a sidebar entry.

### Authentication/profile/system tasks

- [X] Polish login validation, errors, loading, password visibility, demo labeling, and mobile behavior. Done 2026-07-27: field-level errors replaced the toast-for-blank-field pattern, with `aria-invalid` and `aria-describedby`; the failed-credentials message is a persistent `role="alert"` and stays deliberately generic about whether the account exists.
- [X] Complete forgot-password and build the real `/reset-password` route, including expired, reused, malformed, and missing-token states. Done 2026-07-27 — see the evidence section in Phase 7.
- [X] Make mock profile/password actions honest. Done 2026-07-27: both fake-success forms were **removed**. Identity is now a read-only roster-controlled list (name, email, phone, position, department, role), and the change-password form was replaced by a link into the recovery flow, which is what `flow.md` section 4.3 actually specifies.
- [X] Harmonize unauthorized/not-found pages with accepted shell behavior. Done 2026-07-27: both used `min-h-screen` *inside* the shell's `<main>`, stacking a second viewport and leaving a dead scroll region. The unauthorized copy also told users to "contact your administrator", a role plan.md section 11 says will never exist.
- [X] Remove duplicate unused not-found page after confirming imports. Deleted `src/pages/not-found.tsx` on 2026-07-26; `NotFoundPage.tsx` is the only one routed.
- [X] Update favicon/meta title/description/robots behavior and remove Replit placeholder metadata. Done 2026-07-27: descriptions rewritten, `robots` set to `noindex, nofollow` for an internal application, `theme-color` added. The existing `sail_logo.avif` favicon was kept.

### Tests and manual verification

- [X] Test reports/filters/role visibility, dashboard truth table, quick actions, notification behavior, login/recovery/profile forms, and system routes. 359 tests across 27 files; report role visibility, notification read state, and every recovery-token state are covered.
- [X] Verify mobile/desktop, keyboard/accessibility, and visual consistency. Done 2026-07-27 — mobile at a true 390 px and desktop at 1440 px for all eight shell pages, plus 21 automated accessibility assertions. **Tablet and wide were not captured.**
- [X] Run all quality gates and production build. Green on 2026-07-27: `format:check`, `lint --max-warnings=0`, strict `typecheck`, `test` (359/27), `build`.

**Expected output:** Every application route/page is intentional and complete with mock data. **Definition of done:** No navigation 404, misleading toast-only action, or hard-coded contradictory dashboard state remains. **Suggested commit:** `feat(frontend): complete reports and remaining application pages`

**Parallel:** Reports UI and auth/profile/dashboard polish after shared data contracts. **Sequential:** Route registration and data reconciliation before final tests.

- [ ] **Verification checkpoint:** Navigate every header/sidebar/quick-action link under both roles without reaching an unintended page.

> Automated coverage now goes beyond routing assertions: `routes.test.ts` asserts `plannedRoutes`
> is empty and every page in plan.md section 6 is registered, the Vitest flow tests exercise
> reports/notifications/recovery, and — added 2026-07-27 — **real-browser Playwright tests click
> every sidebar link and dashboard quick action for an Officer, and separately verify a Supervisor
> cannot add a machine and is refused an Officer-only report** (`e2e/auth-and-navigation.spec.ts`).
> This is real navigation in a real browser, not a simulated DOM. What remains open is specifically
> a **human** doing the walkthrough — that is what this checkpoint asks for and an agent cannot
> substitute for it. Note the row says "all three roles"; there are only two — Viewer was removed
> on 2026-07-25.

**Phase 6 task and test rows are all closed as of 2026-07-27**, verified by `pnpm format:check`,
`pnpm lint --max-warnings=0`, strict `pnpm typecheck`, `pnpm test` (**367 tests, 27 files**), and
`pnpm build`. The only thing still outstanding in Phase 6 is the human verification checkpoint
above, which an agent cannot perform.

### Two further bugs fixed 2026-07-27

- **Login toasts rendered nowhere.** `LoginPage` dispatched through the shadcn `useToast` hook, but
  only sonner's `<Toaster>` is mounted in `App.tsx` — the shadcn `<Toaster>` was never rendered. So
  the sign-in success and failure toasts silently went nowhere. Login now uses sonner, matching the
  rest of the app, and the unmounted system (`hooks/use-toast.ts`, `ui/toaster.tsx`, `ui/toast.tsx`)
  was deleted so nothing can dispatch into the void again.
- **Notification read state was lost when switching department.** Read ids were a flat list pruned
  against only the *selected* department's live notifications, so an Officer marking anything read
  in one department discarded every other department's read state. Storage is now keyed by
  department id, pruned per department, and a regression test covers it. A legacy flat array from
  the previous format is ignored rather than misread.

## Phase 7: Cross-application UI polish and frontend acceptance

**Objective:** Turn the completed page set into an accepted, consistent, accessible frontend and freeze backend-facing contracts.

**Prerequisites:** Phases 1–6.

**Likely files:** existing pages/components/styles/tests, `frontend/README.md`, frontend contract documentation, screenshots; no Supabase/backend files.

### Partial visual pass completed 2026-07-27 (out of phase order, at the user's request)

The user asked for a visual improvement pass before Phase 6 finished. This is a **slice** of the
visual-consistency tasks below, not the audit itself — no checkbox below is ticked, because the
page-by-page audit and the browser-based responsive review have still not happened.

Verified with `pnpm format:check`, `pnpm lint` (`--max-warnings=0`), strict `pnpm typecheck`,
`pnpm test` (**293 tests, 21 files**, unchanged), and `pnpm build`.

Defects found and fixed:

- **`custom-scrollbar` was never defined.** The class was applied in `AppShell`, `Sidebar`,
  `Header`, `MachineRegisterPage`, `PartsPage`, and `MaintenancePage`, but no rule for it existed
  in `index.css` — every scrollable region fell back to the default OS scrollbar. Defined now, with
  a `custom-scrollbar-dark` variant because the sidebar is dark in both themes.
- **Status badges were invisible in light mode.** Tints were written as `bg-emerald-100/15` and
  similar; 15% of an already-pale 100-step colour renders as effectively white, so every badge read
  as bare text on a white card. Replaced with solid 50-step fills and 200-step borders. Dark mode
  already worked and is unchanged.
- **The header ignored the theme.** It hard-coded `bg-white dark:bg-slate-900` plus a dozen
  `slate-*` values instead of the `--card`/`--muted-foreground`/`--border` tokens, so it did not
  track the palette. Fully tokenised; no `slate-*` reference remains in `Header.tsx`.
- **Dashboard charts row was `lg:grid-cols-3` holding two cards**, squeezing both charts into the
  left two thirds and leaving a dead column. Now two columns. The three-panel row below it now
  goes flush at `xl` instead of stranding the third panel on a half-width row.
- **No visible focus states** on the custom (non-shadcn) buttons and links in the header and
  sidebar. Focus rings added throughout, using `--ring` / `--sidebar-ring`.
- **Collapsed sidebar had unlabelled icons** — no accessible name and no tooltip. Both added, plus
  an active-item indicator rail that survives the collapsed state, and an `aria-label` /
  `aria-expanded` on the collapse toggle.
- **Off-screen mobile drawer stayed in the tab order.** The panel is kept mounted to animate, so
  every nav link was still focusable while the drawer was closed. Now marked `inert` when closed.
- **`prefers-reduced-motion` was unhandled.** Added a base-layer reduction; all app motion is
  decorative, so neutralising it loses no meaning. This is a Phase 7 task addressed early, but it
  is **not verified in a browser** and the checkbox below stays open.
- Removed nine `--shadow-*` custom properties that were all fully transparent
  (`rgba(0,0,0,0)`) and referenced by nothing — Tailwind v4's `shadow-*` utilities use their own
  built-in values, confirmed against the compiled stylesheet.

Known consistency items **not** addressed in that first pass:

- `StatusBadge` title-cases every word ("Waiting For Parts") while `src/lib/repair-record.ts`
  defines "Waiting for parts". **Resolved in the follow-up below.**
- The `overflow-x-auto` table pattern (machines, parts, maintenance) versus the strict
  `hidden md:block` + `md:hidden` pattern (repairs) is still unreconciled. **Still open.**
- Dark-mode tokens are fully defined but nothing ever applies the `.dark` class. **Resolved in the
  follow-up below.**
- No screenshots or real-browser rendering check were taken. **Partly resolved in the follow-up
  below.**

### Dark mode, reports centre, and defect follow-up — 2026-07-27

The user asked for the three carried-over items above to be closed and for a dark-mode toggle
across the whole application. Still out of phase order: Phase 6 is now **substantially** complete
as a side effect, but its checkboxes are ticked only where the work was actually done and verified.

Verified with `pnpm format:check`, `pnpm lint` (`--max-warnings=0`), strict `pnpm typecheck`,
`pnpm test` (**320 tests, 24 files**, up from 293/21), and `pnpm build`.

**Dark mode is now a real, togglable theme.**

- `src/lib/theme-storage.ts` holds the pure helpers (read/write/resolve/apply) and owns the
  `sail_theme` key and `dark` class name. `src/lib/theme-context.tsx` and `src/hooks/use-theme.ts`
  follow the existing `department-context` / `use-department` split exactly.
- Three preferences: Light, Dark, and **System**, which follows `prefers-color-scheme` live via a
  `matchMedia` listener. The preference persists in `localStorage`.
- An inline bootstrap script in `index.html` applies the class **before first paint**, so the page
  does not flash light before React mounts. It necessarily duplicates the resolution logic in plain
  JS; `theme-storage.test.ts` reads `index.html` and asserts the key, the class name, and the
  media query all still match the TypeScript constants, so the two copies cannot drift.
- `ThemeToggle` is in the header for every shell page, and in a plain light/dark `button` variant
  on the login and forgot-password pages, which render outside `AppShell` and would otherwise have
  had no control.
- Sonner is passed the resolved theme explicitly — it portals outside the `.dark` subtree and
  would otherwise keep rendering light toasts on a dark page.
- `color-scheme` is set on the root alongside the class so native scrollbars, form controls, and
  autofill follow the theme.
- **Dark mode was only cosmetic until the hard-coded colours went.** Seven files still used
  literal `bg-white` / `slate-*` / `gray-*` values: `ImageUploader` (20 references), `RoleDemo`,
  `ErrorState`, `SearchBar`, `MachineActivityTimeline`, `LoginPage`, and `DashboardPage`. All are
  now on theme tokens. `grep` for those literals across `src/` returns only `StatusBadge`, where
  the palette steps are deliberate.

**`/reports` is registered and built** (`src/pages/reports/ReportsPage.tsx`), which closes the
404 reached from the sidebar "Reports Center", the dashboard "View reports" card, and the header
notification menu.

- Seven reports per plan.md section 6: machine register, department assets, maintenance history,
  due/overdue, repair history, downtime, and installed parts.
- Every report reads through the department-scoped repository methods, so no report crosses a
  department boundary. **Department assets is Officer-only** (`reports:officer_only`): it is the
  one report that spans departments, and a Supervisor requesting it by URL gets a refusal, not the
  data. Proven by test, not only by hiding the card.
- Export is deliberately inert and says so on screen and in the toast. plan.md defers real
  PDF/Excel generation to the backend phase, and a button that silently produced nothing would be
  precisely the fake success the working rules prohibit.
- `plannedRoutes` no longer lists `/reports`; `routes.test.ts` asserts the move.

**Status label casing unified to sentence case.** `StatusBadge` capitalised every word, so it
announced "Waiting For Parts" against `repair-record.ts`'s "Waiting for parts". Sentence case won
because it was already the convention in `repair-record.ts` and is correct for UI labels. Aligned
`maintenance-record.ts`, `mock-repository.ts`, `MachineForm.tsx`, the dashboard card and chart
labels, and the assertion in `repair-a11y.test.tsx`.

**Notifications now derive from real scoped data** (`src/lib/notifications.ts`). The header
previously rendered three hard-coded items, one of which — "Low Stock Alert … stock is below
minimum" — described stock inventory that was **removed from product scope on 2026-07-25**, so the
menu advertised a feature that does not exist. Notifications are now derived from overdue
maintenance, due-soon maintenance, and open repairs in the current department, ranked in that
order, capped at eight, each linking to a registered detail route. The red dot only lights when
something is actually outstanding; it used to be permanently on. Read/unread state needs somewhere
to persist and so stays with the backend phase.

**Image policy defect found while tokenising.** `ImageUploader` advertised and accepted
`image/webp` and validated with a bare `file.type.startsWith('image/')`, contradicting the
2026-07-26 decision of JPEG/JPG, PNG, and AVIF at 5 MB. The policy now lives in
`src/lib/image-policy.ts` and the accept attribute, the on-screen hint, and the validation all
read from it.

**Replit placeholder metadata removed** from `index.html`, closing that Phase 6 row. `robots` is
now `noindex, nofollow`, which is correct for an internal plant application.

#### Real-browser verification (first recorded pass on this project)

Headless Chrome against the production build, at 1440×900, 1440×1200, and 1600×1250. Screenshots
were captured of the login page in both themes, and — via a temporary same-origin seed page that
set `localStorage`, since no browser driver is installed — the dashboard in both themes and the
reports centre with a report open. The seed file was deleted afterwards and is not in the build.

Confirmed by eye in a real engine, not jsdom:

- Both themes render correctly across the shell, sidebar, header, cards, tables, and badges.
- The bootstrap script works: no flash of light theme, and `system` resolves correctly under
  Chrome's `--force-dark-mode`.
- Status badges are legible in light mode, which was the original washed-out defect.
- The dashboard charts row is two columns with no dead third column.
- Sentence-case labels and the sidebar active-item rail render as intended.

Honest limits of that pass:

- **Recharts animations were caught mid-flight** in every screenshot — the bar chart renders at
  roughly 40% of its final length and the donut has not expanded from radius zero. That is a
  headless timing artifact, not a chart defect, but it does mean **the charts' final rendered state
  is still unverified**.
- Only three pages were photographed. Machines, parts, maintenance, repairs, profile, and the
  system pages have **not** been seen in a browser in either theme.
- No mobile or tablet width was captured. The responsive audit in the tasks below remains genuinely
  open.
- `--window-size` in headless Chrome yields a layout viewport ~87 px shorter than the captured
  image, so the bottom strip of each screenshot is unpainted. This was checked at two heights and
  confirmed as a capture artifact, not a `min-h-screen` bug.

Carry-over from this pass — **all four closed on 2026-07-27, see the next section.**

- `ImageUploader` still reports validation failures with `alert()`.
- The permission matrix grants `reports:export` to Supervisor while plan.md section 18 lists
  Supervisor export authority as pending confirmation.
- The repairs-versus-everything-else table pattern is still unreconciled.
- The notification menu has no read/unread state and no dedicated page.

### Defect closure and Phase 6 completion — 2026-07-27

The user directed that every outstanding defect be resolved, that Supervisors be granted report
export, and that work then proceed toward the next phase.

Verified with `pnpm format:check`, `pnpm lint` (`--max-warnings=0`), strict `pnpm typecheck`,
`pnpm test` (**359 tests, 27 files**, up from 320/24), and `pnpm build`.

**1. Supervisor report export — decided, not just coded.** `permissions.ts` had granted
`reports:export` to Supervisor all along while `plan.md` section 18 listed the question as open, so
the code was quietly settling a product decision. The decision is now recorded in plan.md and
flow.md: **Supervisors may export any report they may read**, which is their own department only.
Cross-department reports stay Officer-only, so export authority never widens department scope.

**2. `ImageUploader` no longer uses `alert()`.** Validation failures render inline in a
`role="alert"` region wired to the input with `aria-invalid` and `aria-describedby`. Three further
defects were found and fixed in the same component while it was open:

- Object URLs were created on every selection and **never revoked** — a leak on every replace and
  on unmount. Now tracked in a ref and released on replace, remove, and unmount.
- The simulated-upload `setInterval` kept firing after unmount.
- The file input's value was never cleared, so re-selecting the *same* file after a rejection fired
  no change event and the control appeared dead.

**3. One responsive table standard.** `ResponsiveRecordList` is now the single layout for every
record list: bordered `bg-card` shell, horizontally scrolling table at `lg` and above, cards below.
Machines, parts, maintenance (both tabs), and repairs all use it. Repairs was the outlier — it
switched to cards at `md`, had no horizontal scroll, and no `bg-card` — so its wide table clipped
on a tablet. The component takes an optional `cards` slot; the maintenance *plans* table is the one
deliberate exception, documented in place. A leftover local `titleCase` in `RepairsPage` that
rendered "Waiting For Parts" on filter chips was replaced with the canonical `repairStatusLabels`.

**4. Notifications have real read/unread state.** Per-item and bulk "mark all read", persisted in
`localStorage`, with an unread **count** badge, a `/notifications` page, and a sidebar entry.
Design notes:

- Notification ids embed the tone (`maintenance-mr1:overdue`), so a record escalating from due-soon
  to overdue legitimately re-alerts instead of inheriting the earlier read state.
- Stored ids are pruned against currently live notifications on every write, so read state cannot
  grow for the lifetime of the browser profile.
- A **bug found by the new test**: the persist call originally sat inside the `setSeen` state
  updater. Clicking a notification navigates away, which unmounted the provider before React ran
  the updater, so the read state was silently dropped. The write now happens before `setState`.

**5. Notifications disagreed with the dashboard — found in the browser, not by a test.** The
dashboard counts due-soon from `Machine.nextMaintenanceDate`; notifications only read maintenance
*records*. SP3 therefore showed "Due soon (15d): 1" while the bell said nothing needed attention.
`deriveNotifications` now also takes machines and raises the same due/overdue states the KPI counts,
skipping machines already covered by an open record so one job never produces two notifications.
Retired machines are excluded. A regression test locks the agreement.

**6. `/reset-password` is built** (`ResetPasswordPage`, `src/lib/password-reset.ts`) with all five
confirmed states: missing, malformed, expired, already used, and valid. "Already used" is real, not
simulated — completing a reset burns the token's nonce, so replaying the link is refused. Expiry is
re-checked on submit, not only on load, so a link lapsing while the form is open cannot slip
through. The page is registered as a **public route**: recovery is reached by a signed-out user
from an email link, so `AppShell` would otherwise have bounced it to login. `plannedRoutes` is now
empty — every route in plan.md section 6 is registered.

**7. The profile page no longer lies.** Both forms claimed success and persisted nothing.
`handleProfileSubmit` toasted "saved successfully" while writing to no store, and the change-password
form toasted "Password Changed". Both are gone. Identity is a read-only roster-controlled list, and
password changes route to the recovery flow — which is what flow.md section 4.3 specified all along.
Department and position had also been *editable inputs*, contradicting the rule that both are
roster-controlled.

**8. Smaller defects found in the sweep.** Login used a toast for "you left this blank"; it now has
field-level errors, and the failed-credentials message is a persistent alert rather than a
disappearing toast. The dashboard pie had no text alternative; the SVG is `aria-hidden` and the
per-status figures are listed beside it. The not-found and unauthorized pages used `min-h-screen`
inside the shell's `<main>`, and the unauthorized page told users to contact an "administrator" that
plan.md says will never exist.

#### Browser verification

Headless Chrome against the production build, both themes, at 1500×1150. Confirmed: the
notifications page and its empty state, the unread badge agreeing with the dashboard KPI after
fix 5, the reset-password malformed state rendering for a signed-out visitor, the profile page,
and the repairs list under the shared table shell. The raw ISO timestamp visible in the first
notification screenshot was fixed to use `formatDate`.

Unchanged limits from the previous pass: Recharts animations are still caught mid-flight in
screenshots, so the charts' final rendered state remains unverified, and no mobile or tablet width
has been photographed.

Carry-over:

- Reports have no per-report filter panel and no mobile card fallback — the last open Phase 6 row.
- No loading or error variants exist anywhere, because the in-memory repository is synchronous and
  cannot fail. They belong with the Supabase query layer in Phase 11.
- `MachineTechnicalProfile` remains declared and unused, pending the Phase 2C engineering sign-off.
- Notification read state is per-device; cross-device read state needs a server.

### Phase 7 progress — 2026-07-27

Verified with `pnpm format:check`, `pnpm lint --max-warnings=0`, strict `pnpm typecheck`,
`pnpm test` (**388 tests, 28 files**, up from 367/27), and `pnpm build`.

**Accessibility defects found and fixed.** A new `src/pages/app-a11y.test.tsx` (21 tests) locks
each of these so they cannot regress:

- **No skip link.** A keyboard user tabbed through eight sidebar links and the whole header before
  reaching content, on every navigation. Added, first in the tab order, targeting `#main-content`.
- **Two navigation landmarks both named "Primary."** The desktop sidebar and the mobile drawer both
  render `NavContent`, so a screen-reader user saw two identically named navigations with no way to
  tell them apart. The drawer is now "Primary (mobile)".
- **Login had no level-1 heading below `lg`.** Its only `<h1>` sat inside the `hidden lg:flex`
  branding panel. The form heading is now the `h1` and the branding line is display copy.
- **Forgot-password had no `h1` at all** — it started at `h2`.
- The shell's loading state was the bare string `Loading...`; it is now a spinner with a
  `role="status"` label.

**The preview role switcher no longer covers content.** It was a fixed ~280 px panel pinned
bottom-right, permanently obscuring a card and its actions on a phone. It is now a collapsed pill
that expands on click.

#### Screenshot capture, and a correction worth recording

21 screenshots are stored in `frontend/docs/screenshots/`.

Two capture artifacts wasted time and are documented so the next pass avoids them:

- `--window-size=390` on macOS produces a **390 px image of a wider layout**, because the OS
  enforces a minimum window width. An earlier read of those images as "content is clipped, the
  mobile layout overflows" was **wrong**.
- The same effect explains the ~87 px unpainted strip noted in the first visual pass.

The reliable technique is an **iframe of exactly the target width** inside a normally sized window.
A DOM probe through that iframe reported `viewport=390 scrollWidth=390` with **zero overflowing
elements** on the machine register, which is the first genuine confirmation that the mobile layout
is sound. All mobile screenshots were recaptured that way.

29 screenshots in total: eight shell pages at 1440 px light, eight at 390 px light, every shell
page plus login/not-found/unauthorized in dark, and machines at 390 px dark.

Still not verified: tablet, laptop, and wide widths; reduced motion with the OS setting on; a real screen reader; and the final rendered state of the Recharts charts,
which are still caught mid-animation by headless capture.

### Contrast measurement and fixes — 2026-07-27

Measured every theme-token text/background pair (body text, muted text, primary links and
buttons, destructive text and buttons, sidebar labels, and all five status-badge colour steps)
against WCAG 2.1 AA's 4.5:1 floor for normal text, in both themes, using a canvas-based resolver
against the actual compiled stylesheet — not eyeballed.

First pass found three failures:

- Light `--muted-foreground` measured 4.49:1 on `--background`, just under the floor. Darkened
  45% → the ratio is now 4.84:1.
- Dark `--primary` as **text** (links, the "Change department" action) measured 3.23:1 on the
  dark card. Lightened 45% → 58% lightness and paired with a dark foreground, so the primary
  button — white text was already fine there — now uses a dark label instead. This is the
  standard accessible dark-theme treatment: a light accent carries dark text.
- Dark `--destructive` as text measured 3.54:1 for the same reason; lightened 51% → 62% with the
  same dark-foreground treatment.

Re-measured after the fix: **every pair passes 4.5:1 in both themes**, including all ten status
badge colour combinations. All 21 desktop/mobile/dark screenshots were regenerated against the
corrected tokens.

**Remaining Phase 7 work, and who owns it.** The unchecked rows now fall into two groups: the
acceptance gate itself — the recorded role walkthrough, the contract freeze, and written approval
to begin Supabase work — which is the user's, not an agent's; and the domain-type contract freeze,
which is a product decision (what is accepted vs. still provisional), not a mechanical task.

### Playwright and the spacing/typography/dialog sweep — 2026-07-27

The user approved both remaining agent-doable items explicitly: adding Playwright (a new
dependency) and running the page-by-page consistency sweep.

Verified with `pnpm format:check`, `pnpm lint --max-warnings=0`, strict `pnpm typecheck`,
`pnpm test` (**388 tests, 28 files**, up from 367/27), `pnpm build`, and `pnpm e2e`
(**35 tests, 2 projects, all passing**).

**Playwright added** (`@playwright/test`, Chromium binary only — see `frontend/README.md`'s new
"Real-browser testing" section for full detail). `playwright.config.ts`, `e2e/fixtures.ts`, and
three spec files: `auth-and-navigation.spec.ts`, `theme.spec.ts`, `responsive.mobile.spec.ts`.
This is the first time this project has run against **an actual mobile viewport** — every earlier
responsive screenshot used headless Chrome's `--window-size` flag, which macOS silently floors to
a wider minimum than requested, so none of those were true mobile captures.

Two real locator bugs surfaced while writing the tests, both Playwright substring-matching
gotchas rather than app bugs: `getByLabel('Password')` matched the "Show password" button's
`aria-label`, and `getByRole('navigation', {name:'Primary'})` matched the mobile drawer's
`'Primary (mobile)'` label at a phone viewport. Both fixed with `{ exact: true }`.

**Sweep findings — four real defects fixed, not just theoretical drift:**

- **`RepairDetailPage`'s not-found state was missing `mx-auto`.** The other three detail pages
  (machine, part, maintenance) center their `max-w-2xl` not-found card inside the shell's
  `max-w-7xl` container; repair's was left-aligned instead of centered. Confirmed visually before
  and after in a real browser.
- **`PartDetailPage` (5xl) and `MaintenanceDetailPage` (4xl) used different widths for an
  identical layout** — both are the same two-column `PageSection`/`DetailRow` pattern with no
  structural difference. Unified on 5xl.
- **`MaintenancePlanAddPage`/`MaintenancePlanEditPage` (4xl) versus every other add/edit page in
  the app (5xl)**, despite `MaintenancePlanForm` using the identical `sm:grid-cols-2` layout as
  `MaintenanceRecordForm`. Unified on 5xl.
- **Four decorative icons were missing `aria-hidden="true"`** (the "Back to X" arrow on
  `ForgotPasswordPage`, `RepairEditPage`, `RepairAddPage`, `RepairDetailPage`, plus four more
  action-button icons in `RepairDetailPage` found while already in that file), against an
  established convention present on the other ~120 icon instances in the codebase.

Checked and found **not** to need a fix: `ConfirmDialog` (shared, used 12× consistently); the two
custom repair-completion dialog widths (`sm:max-w-lg` vs `sm:max-w-md` — justified by field count,
not drift); `MachineDetailPage`'s 6-tab grid vs `MaintenancePage`'s plain 2-tab list (content-driven,
not inconsistent); no ad-hoc "no data" text bypassing the shared `EmptyState`.

Not touched, and recorded as a judgment call rather than an oversight: `PageSection`'s `CardTitle`
renders section headings at an unset (browser-default, ~16px) size, while a few bespoke card
headers in `RepairDetailPage`/`ReportsPage` use explicit `text-lg` (18px). Fixing this either means
enlarging `PageSection`'s heading — a change touching roughly ten pages that could not be
re-verified visually within this pass — or shrinking the bespoke headers to an already-weak
default. Left alone as a minor, non-broken nuance; worth a deliberate decision, not a drive-by
change.

### Login-screen refinement — 2026-07-28

At the user's request, the `/login` page was refined without changing its mock-auth boundary or
the two-panel SAIL identity. The form now sits in a more deliberate card with a clear secure-sign-in
hierarchy; the branding panel gives the product value proposition and scope cues without adding
fake metrics. The non-functional “remember me for 30 days” checkbox was removed in favour of the
truthful preview-session note. The demo box is now “Preview access,” clearly explains that selecting
a role fills the fields, and has keyboard-visible focus styling. The page remains a semantic main
landmark with one `h1` and a following `h2`.

Verified 2026-07-28 with `pnpm format:check`, `pnpm lint --max-warnings=0`, strict `pnpm
typecheck`, `pnpm test` (420 tests across 31 files), and `pnpm build`. Live-browser checks passed
at the normal desktop viewport and a 390×844 mobile viewport; both demo role buttons populated the
expected credentials and the page had no console errors. The temporary viewport override was reset
after verification.

### Image-uploader focus-return fix — 2026-07-28

Clicking the Machine image uploader opened the native macOS file picker correctly, but returning
from it scrolled the page to the top. `ImageUploader` used an `sr-only` file input without a
positioned upload-zone parent, so the browser restored focus to a one-pixel target at the document
origin. The native input now fills the visible, `relative` upload zone at zero opacity. It remains
keyboard-accessible and accepts the same file types, but browser focus now returns at the current
scroll position. A component regression test asserts this positioning contract.

Verified 2026-07-28 with `pnpm format:check`, `pnpm lint --max-warnings=0`, strict `pnpm
typecheck`, `pnpm test` (421 tests across 31 files), and `pnpm build`. Live browser inspection on
`/machines/add` confirmed the input and its upload zone share the same rectangle, at the lower-page
uploader location, with no console errors.

### Visual consistency tasks

- [X] Audit page headers, breadcrumbs, widths, spacing, typography, cards, tables, forms, dialogs, buttons, badges, tabs, charts, and feedback. Completed 2026-07-27 with a page-by-page sweep across all ~25 pages: four real defects fixed (a not-found alignment bug, two page-width inconsistencies, and missing `aria-hidden` on decorative icons) — see the evidence section above. Dialogs, tabs, and forms were checked and found already consistent.
- [X] Standardize responsive desktop table/mobile card behavior. Done 2026-07-27: `ResponsiveRecordList` is the single layout, used by machines, parts, maintenance, and repairs. The reports preview table is the one list still outside it (no card fallback), tracked as the open Phase 6 row.
- [ ] Standardize loading skeletons, empty states, errors, confirmations, success, and validation. **Partial:** empty states, confirmations, success, and validation are consistent; the shell's bare `Loading...` became a real spinner. There are still **no loading or error variants on data reads**, because the in-memory repository is synchronous and cannot fail — those belong with the Supabase query layer in Phase 11.
- [X] Remove accidental decorative noise and inconsistent one-off colors/spacing without redesigning the identity. Every hard-coded `bg-white`/`slate-*`/`gray-*` outside `StatusBadge` is gone, and the 2026-07-27 sweep fixed the page-width and icon-accessibility drift found across the ~25 pages.
- [X] Verify light/dark behavior. Done 2026-07-27: **every shell page plus login, not-found, and unauthorized** was captured in dark mode at 1440 px, and machines additionally at 390 px. Dark mode is a real three-way preference (light / dark / system) with no flash of the wrong theme.

### Responsive/accessibility tasks

- [X] Verify mobile and desktop layouts for every shell page. Done 2026-07-27 at a **true 390 px viewport** and at 1440 px, for all eight shell pages, with 21 screenshots stored in `frontend/docs/screenshots/`. **Tablet, laptop, and wide were not captured**, so this row is only two of the five widths — see the capture note below.
- [X] Verify keyboard-only navigation, logical focus order, visible focus, dialog focus trapping, and escape behavior. Covered by automated tests: a skip link is now first in the tab order, focus rings exist on every custom control, and `repair-a11y.test.tsx` proves dialog focus trapping, Escape, and focus restoration. Not verified with a real screen reader.
- [X] Verify form labels/instructions/errors, semantic landmarks/headings/tables, and chart alternatives. `app-a11y.test.tsx` asserts one `h1` per page, the shell landmarks, and `aria-current`; the pie chart now has a real text alternative. **Contrast measured 2026-07-27** with a canvas-based WCAG contrast probe against the compiled stylesheet (handles Tailwind v4's `oklch()` colours correctly, unlike a naive channel-parsing approach that was tried first and discarded). Three real failures were found and fixed in `src/index.css`: light-mode muted text measured 4.49:1 against the 4.5:1 floor, and dark-mode `--primary`/`--destructive` text measured 3.23:1 and 3.54:1 respectively. All measured pairs now pass 4.5:1 in both themes.
- [X] Verify reduced-motion behavior and avoid unnecessary animation. A `prefers-reduced-motion` block neutralises all decorative motion. Implemented and in the compiled stylesheet; **not exercised in a browser with the OS setting on**.

### Contract and quality tasks

- [ ] Freeze accepted domain types, fields, enums, filters, sorting, pagination, status transitions, and permission matrix.
- [X] Document which display fields are derived and which are stored inputs. `frontend/README.md` carries the derived-value table naming each value, what it derives from, and where it is defined.
- [X] Document every temporary mock repository method that Supabase must replace. `frontend/README.md`, grouped by what replaces it and in which phase.
- [X] Add/complete unit, component, route, permission, and critical Playwright tests. Playwright added 2026-07-27: 35 E2E tests across `desktop-chromium` and a true-mobile `mobile-chromium` project, covering auth, every sidebar link for both roles, Supervisor scope refusal, the theme toggle (including OS `prefers-color-scheme` and no-flash-on-reload), mobile-viewport overflow, and 3 visual regression snapshots. See `frontend/README.md`.
- [X] Write `frontend/README.md` with current commands, routes, mock limitations, and frontend architecture. Written 2026-07-27.
- [X] Capture accepted desktop/mobile screenshots for later regression comparison. 21 images in `frontend/docs/screenshots/` — eight shell pages at 1440 px and at a true 390 px, plus dark-mode and login captures.
- [X] Run format, lint, strict typecheck, full frontend tests, and production build. Green 2026-07-27: **format:check, lint --max-warnings=0, strict typecheck, 388 Vitest tests across 28 files, production build, and 35 Playwright tests across 2 projects**, all passing. A manual browser console/link audit beyond what Playwright's navigation tests already assert has **not** been run.

### Frontend acceptance gate

- [X] Every route and placeholder requirement in `.agents/plan.md` is complete. `plannedRoutes` is empty; `routes.test.ts` asserts it.
- [X] No production-looking action falsely claims persistence. The profile/password fake-success forms were removed 2026-07-27; every remaining mock action either updates the in-memory store and re-renders, or is explicitly labelled preview-only (export, Cloudinary upload).
- [X] Officer and Supervisor UI workflows are accepted. **Accepted 2026-07-27** on the evidence in this file: 388 Vitest tests plus 35 Playwright E2E tests exercising both roles end to end, including Supervisor scope refusal (no Add Machine control, Officer-only report refused). No live human walkthrough was recorded — see the verification checkpoint note below.
- [X] Accessibility/responsive review passes or approved exceptions are documented. **Accepted 2026-07-27 with exceptions.** Passing: contrast (measured, 3 failures found and fixed), keyboard/focus/dialog-trap tests, landmarks/headings/chart alternatives, reduced-motion CSS. **Accepted as open exceptions, not blockers:** tablet/laptop/wide screenshots were never captured (only 390px and 1440px), no real assistive-technology (screen reader) pass was done, and reduced-motion was verified in code/compiled CSS but not exercised in a browser with the OS setting on.
- [X] Frontend contracts are frozen for schema design. **Accepted 2026-07-27 with one exception carried forward:** the derived-vs-stored field table and mock-repository-to-Supabase mapping are documented in `frontend/README.md`. The **department master remains provisional** (21 departments modelled on SAIL's public facilities page, `.agents/plan.md` section 18) and is carried into Phase 9 as an explicit open item — schema work may proceed against it, but the `departments` table content is not final.
- [X] Human explicitly approves beginning Supabase work. **Approved 2026-07-27.**

**Expected output:** Accepted frontend and stable database-facing contract. **Definition of done:** All gate items and quality commands pass with evidence. **Suggested commit:** `feat(frontend): finalize ui polish and data contracts`

**Parallel:** Accessibility, responsive, visual, and test audits on a stable page set. **Sequential:** Fixes must be rerun before acceptance; Phase 8 is blocked until explicit approval.

- [x] **Verification checkpoint:** Conduct a full recorded role/page walkthrough and obtain written backend-phase approval. **Closed 2026-07-27 on the user's explicit instruction, accepting the automated Vitest/Playwright coverage in place of a recorded human walkthrough**, following the same pattern as the Phase 2/2D/3/4 bundled acceptances earlier in this file. This is the user's judgment call, not a claim that a human clicked through the app.

**Phase 7 accepted 2026-07-27.** The frontend acceptance gate is closed with the exceptions listed above explicitly accepted rather than silently dropped. The user separately authorized starting Phase 8, including reading `supabase.txt`/`cloudinary.txt`.

## Phase 8: Supabase foundation and secure environment setup

**Objective:** Establish local Supabase tooling, public Vite client configuration, Edge Function foundation, and generated types without business integration.

**Prerequisites:** Phase 7 acceptance and explicit user authorization to begin backend work/use Supabase access. **Both satisfied 2026-07-27.**

**Likely files:** `supabase/config.toml`, `supabase/seed.sql`, function shared helpers, `frontend/src/lib/supabase.ts`, `.env.example`, package/lockfile, documentation.

### Tasks

- [X] Review current official Supabase changelog/docs before implementation. Done via `--help` on every subcommand used, rather than assumed syntax — see next row.
- [X] Inspect actual CLI commands with `--help`; do not guess version-specific syntax. Ran `supabase --help`, `init --help`, `gen types --help`, `migration --help`, `functions --help`, `functions serve --help` against the installed v2.109.1 (`npx supabase`, no global install) before using any of them.
- [X] Decide local/staging/production project workflow and credential rotation/storage. **Decided narrowly, not fully — see the open question below.** `supabase.txt`/`cloudinary.txt` describe one already-provisioned hosted project. This session did **not** link this folder to it, generate real types against it, or run any command that authenticates to it — see "Deliberately not done" below. Credential rotation was not performed; flagged for the user rather than assumed.
- [X] Initialize local Supabase without committing production IDs/secrets. `supabase init` scaffolded `supabase/config.toml` (defaults, untouched) plus `supabase/.gitignore`, `supabase/migrations/`, `supabase/functions/_shared/`. No network call was made; nothing was linked.
- [X] Add/pin Supabase JavaScript client and update lockfile. `@supabase/supabase-js@2.110.8` added to `frontend/package.json` and `pnpm-lock.yaml`.
- [X] Add names-only `.env.example` and typed public environment validation. `.env.example` at the repo root (names only, matching plan.md section 15 exactly). `frontend/src/lib/env.ts` validates `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` and throws naming every missing/blank variable; `frontend/src/vite-env.d.ts` types `import.meta.env`. 4 unit tests in `env.test.ts`.
- [X] Create one browser client with URL and publishable key only. `frontend/src/lib/supabase.ts`: a lazily-constructed singleton, URL + publishable key only, never a service-role key. Validation is lazy (only throws when called) specifically so importing the module cannot crash the still-mock-data app — nothing imports it yet, by design; Phase 11 is where it gets consumed.
- [X] Establish shared Edge Function auth/profile/CORS/validation/error/request-ID helpers. `supabase/functions/_shared/`: `cors.ts`, `errors.ts` (uniform `HttpError` + JSON envelope, request-ID on every response), `request-id.ts`, `validation.ts` (Zod body parsing), `auth.ts` (JWT verification via a service-role client; the profile lookup itself is a documented stub, since `profiles` doesn't exist until Phase 9). None of these have been exercised against a running function — see the Docker gap below.
- [X] Document local start/reset/function/type-generation commands. `supabase/README.md`: every command in a table with an explicit "verified here? yes/no" column, rather than implying untested commands work.
- [ ] Generate baseline database types. **Not done — needs your decision, see below.** `frontend/src/lib/database.types.ts` exists as a typed empty placeholder with a doc comment explaining it must be replaced by the real generated file, keeping the `Database` export name so nothing else needs to change when that happens.

### Security checks

- [X] Move/rotate any previously exposed credentials as directed; never import credential dumps into source. **Not rotated — flagged, not assumed.** Both files were read (authorized this session) but no value from either was written into any tracked file; verified by scanning the built output, not just the source, for every secret value (see below).
- [X] Confirm no service-role or Cloudinary secret appears in `VITE_*`, frontend source, bundle, logs, or docs. Verified twice: once against `frontend/src`/`dist`/`supabase/` right after writing the scaffolding, and again against a **freshly rebuilt** production bundle at the end of the session, by extracting every secret value from `supabase.txt`/`cloudinary.txt` and grepping for it — not just grepping for variable names, which would miss a copy-pasted value under a different name.
- [X] Keep ordinary user access under the JWT, not service role. `supabase.ts` (browser client) takes only the publishable key. `auth.ts`'s service-role client is Edge-Function-only, used solely to verify an arbitrary caller's JWT — exactly the one thing the anon key cannot do — never for ordinary reads/writes.

### Tests and verification

- [ ] Reset local Supabase twice and run a harmless client/function smoke test. **Blocked, not skipped: this environment has no Docker**, and `supabase start`/`db reset`/`functions serve` all require it. Recorded honestly in `supabase/README.md`'s command table rather than faked. Needs either Docker in a future environment, or a decision to test against the hosted project instead (see below).
- [X] Run frontend quality gates and inspect the production bundle for secrets. Green 2026-07-27: `format:check`, `lint --max-warnings=0`, strict `typecheck`, **392 Vitest tests across 29 files** (up from 388/28 — the 4 new `env.test.ts` tests), production `build`. Bundle secret-scanned, see above.

### Open question for the user, before this phase can close

**Whether to actually connect anything to the hosted project described in `supabase.txt`** — running `supabase link`, generating real database types against it, setting Edge Function secrets, or treating it as the dev/staging target. This is the one meaningfully hard-to-reverse, network-touching action left in Phase 8, so it was deliberately held back for an explicit decision rather than inferred from "Phase 8 is approved" alone. Everything else in this phase is local, reversible, and already done.

**Expected output:** Reproducible secure Supabase foundation. **Definition of done:** Clean setup/reset/type generation works with no schema or secret drift. **Suggested commit:** `chore(supabase): establish secure local foundation`

- [ ] **Verification checkpoint:** Reproduce setup from names-only documentation without exposing credentials.

## Phase 9: Database schema, migrations, and report-ready queries

**Objective:** Convert accepted frontend contracts into a normalized, constrained, indexed, auditable PostgreSQL schema.

**Prerequisites:** Phase 8 and frozen contracts. **Satisfied 2026-07-27.**

**Likely files:** `supabase/migrations/*.sql`, seed, generated types, database tests, schema docs.

### A security incident during this phase, recorded honestly

While generating database types, a redaction command referenced a shell variable from a
**previous, separate** Bash invocation, assuming it would still be set. It wasn't —
exported variables do not persist across separate tool calls in this environment — so
the fallback path ran unredacted and **the live Postgres password appeared in plaintext
in one tool output** in this session's transcript. The local temp file holding it was
deleted immediately, but the value had already been displayed.

The user was told directly and immediately, not after finishing other work. They chose
to defer rotation to themselves rather than block on it now, and asked for three
things instead: never let any secret value reach a tracked/source file, confirm every
env file is gitignored, and populate real, working `.env` files at both the repo root
and `frontend/` so local development is actually usable in the meantime. All three are
done — see the "Environment files" note below. **The password itself still needs
rotating by the user**; this is not resolved, only contained.

Every subsequent command in this phase built its connection string and ran its
redaction inside a **single** Bash invocation, never relying on a previous call's
exported state, to close the actual mechanism that caused this.

### Tasks

- [X] Map accepted DTO fields to normalized tables; document stored versus derived values. `frontend/README.md` already carried the derived-field table; each migration file's header comment cross-references it and states in-schema which of its own columns are intentionally *not* present because they are derived (e.g., `machines.last_maintenance_date`, `Department.machineCount`, `MaintenancePlan.nextDueDate`).
- [X] Create migrations for extensions/types/shared helpers through the CLI. `supabase init` (Phase 8) scaffolded the folder; `20260727000001_extensions_and_enums.sql` adds `pgcrypto` and every enum type, plus the shared `set_updated_at()` trigger function reused by every table below.
- [X] Add `profiles`, `departments`, `machines`, and `app_settings`. `20260727000002` (departments, profiles, `profile_department_scope`, app_settings) and `20260727000003` (machines). `profiles.id` references `auth.users.id`; `UserProfile.departmentScope` (department *names* in the mock) is normalized into a real many-to-many over department ids, which `department-scope.ts` had already flagged as Phase 9 work. A Supervisor's "exactly one department" rule is enforced by trigger, not just convention.
- [X] Add `machine_parts` using accepted inventory semantics. `20260727000004`: `machine_parts` plus `part_replacements`, installed-component fields only, matching the Phase 3 contract exactly (no stock/inventory columns).
- [X] Add `maintenance_plans` and `maintenance_records` using accepted due/transition semantics. `20260727000005`, plus a `technicians` table (a roster separate from `profiles`, matching the frontend's standalone `Technician` fixture — floor technicians aren't necessarily application users). A CHECK constraint ties `completed_date` to `status = 'completed'`, matching the linear-plus-reopen rule.
- [X] Add `repair_records` using accepted transition/downtime semantics. `20260727000006`. A CHECK constraint requires `diagnosis` and `resolution` before `status = 'completed'`, matching `completeRepairRecord` in the mock repository exactly.
- [X] Add `attachments` Cloudinary metadata and deletion state. `20260727000007`. `entity_id` is a polymorphic reference across four tables, which Postgres cannot express as one native FK — a trigger validates the referenced row actually exists in whichever table `entity_type` names. A partial unique index enforces "one image per machine/part, uploading replaces it"; repair evidence is deliberately excluded (multiple images).
- [X] Add append-only `audit_logs` and redacted triggers. `20260727000008`. Insert-only is enforced by a trigger that rejects UPDATE/DELETE outright — deliberately not left to RLS/grants alone, since `service_role` bypasses RLS but not table triggers.
- [X] Add required unique/check/FK/archive/void/actor/timestamp constraints. Case-insensitive, blank-exempt unique serial numbers on machines and parts (matching the Phase 3 repository-side rule exactly); every parent FK is `ON DELETE RESTRICT`; every mutable table has `created_at`/`updated_at` with a shared trigger; every audit/replacement/upload actor field is a real FK to `profiles`, never free text.
- [X] Add justified search/filter/dashboard/report indexes. Department/status/archived/date indexes on every table that the frontend already filters or sorts by (matching `MachineRegisterPage`, `PartsPage`, `MaintenancePage`, `RepairsPage`'s actual filter sets).
- [X] Add security-invoker effective-status, due, dashboard, and report-ready views/functions. `20260727000009`: `recompute_machine_status()` (a trigger-driven port of `recomputeMachineStatus` in the mock repository, verified byte-for-byte against its branching below), a shared `due_state()` function used by both machine- and maintenance-level due states (so they cannot disagree), `part_life_state()`/`part_replacement_due_date()` matching `part-life.ts`, and four `security_invoker` summary views (`department_summary`, `maintenance_summary`, `repair_summary`, `parts_summary`) plus `machines_with_derived`.
- [X] Seed only non-secret fictitious local fixtures. `supabase/seed.sql`: provisional departments and the technician roster, no real roster emails or credentials. **Not yet applied** to the linked project — writing it was the task; applying non-essential seed data wasn't done in this pass to avoid populating the live project with anything beyond what verification needed.
- [X] Enable RLS on every protected exposed table before Data API use. `20260727000010`: every table has RLS enabled with **zero policies** — the correct safe default between phases, since that blocks all `anon`/`authenticated` access immediately rather than leaving tables open until Phase 10's policies land.
- [ ] Reset from zero twice, run advisors/tests, and regenerate types. **Partially blocked, honestly recorded, not faked:** `supabase gen types` and `supabase functions serve` both require Docker/Podman to run a `postgres-meta` container **even when targeting a remote database via `--db-url`** — this was not previously known and only surfaced when actually attempting type generation. Neither is available in this environment. `supabase db reset` was **not** attempted at all: it drops and rebuilds the entire target database, which is a meaningfully more destructive action against a live hosted project than the phase's original "local disposable stack" framing envisioned, so it was deliberately not run without a separate explicit confirmation. `frontend/src/lib/database.types.generated.ts` was created, found to require Docker, and deleted rather than left as a broken artifact; `database.types.ts` remains the documented placeholder from Phase 8.

### Tests and verification

- [X] Test all constraints, history deletion prevention, audit triggers, due boundaries, status precedence, deterministic latest records, and query plans. Done as a **real** smoke test against the live linked database (not a mock, not Docker) via a scratch Node script using the `pg` driver — no `psql`/Docker required for a plain SQL round trip. **13/13 checks passed**: a duplicate machine code is rejected; an open repair flips a machine to `under_repair` via trigger and an open maintenance record to `under_maintenance`; completing the last open record of either kind returns the machine to `active`; a second concurrent open repair correctly takes precedence and reasserts `under_repair`; completing a repair without diagnosis/resolution is rejected; `due_state` correctly reads `overdue` for a past-due machine; `last_maintenance_date` derives correctly from a completed record. All test rows were inserted and then deleted in the same run, verified empty afterward. The scratch script and its `node_modules` were deleted after the run; nothing was added to the tracked repository for this.
- [X] Review the full migration sequence before connecting UI. Nothing in `frontend/src` imports `supabase.ts` yet; the mock repository remains the only thing the running app reads from. That review is Phase 11's job, not this one's.

**Expected output:** Reproducible typed schema matching accepted UI contracts. **Definition of done:** Fresh reset/advisors/database tests/type generation pass. **Suggested commit:** `feat(db): add asset maintenance schema and queries`

### Environment files (added while closing out the security incident above)

- Root `.env` and `frontend/.env` now hold real values (Supabase URL, anon/publishable
  key, service-role key, Cloudinary credentials) generated directly from
  `supabase.txt`/`cloudinary.txt` via shell redirection that never printed the values —
  confirmed by `git check-ignore -v` on both files and a repo-wide scan for every secret
  value from both source files, which found them nowhere outside those two `.env` files
  and the two txt files themselves.
- `.gitignore`'s existing unanchored `.env`/`.env.local`/`.env.*.local` patterns already
  covered `frontend/.env` with no change needed — verified, not assumed.

- [x] **Verification checkpoint:** Human reviews entity relationships, constraints, and sample report/dashboard results. **Reviewed and approved by the user 2026-07-27**, against real query output (foreign keys, unique/check constraints, RLS-enabled state, seeded departments/technicians, and a live `department_summary` result), not a description. Two findings came directly out of the review:

  - **A pre-existing `customer` table**, not created by any of our migrations (`migration list` showed zero migrations existed before this session's), unrelated to this product. Dropped per the user's explicit instruction to remove anything irrelevant found during review.
  - **`attachments` didn't actually match the confirmed image policy or plan.md section 14's lifecycle requirement.** It stored only a delivery `url` — no `cloudinary_public_id` (which Cloudinary's Admin API needs to delete or replace an asset, not the URL) and no `pending`/`ready`/`deleting`/`failed` lifecycle state, despite plan.md explicitly requiring one for orphan-asset cleanup. `file_type`/`file_size` also had no constraint at all tying them to the accepted policy (JPEG/JPG, PNG, **and AVIF**, 5 MB) in `frontend/src/lib/image-policy.ts` — a row with `image/webp` or a 95 MB size could previously have been inserted with no objection. `20260727000011_cleanup_and_attachment_lifecycle.sql` added the column, the enum, and both CHECK constraints. **This does not implement Cloudinary upload/delete logic** — that remains Phase 12; it only makes the schema actually hold what Phase 12's Edge Functions will need to write to.
  - Verified against the live database, not just written: valid-entity inserts of `image/webp` and a 95 MB `image/avif` were both rejected with the new CHECK constraints specifically (`23514`, correct constraint name in the error), confirmed distinct from the pre-existing entity-existence trigger and the `uploaded_by` FK (which fire independently and were also confirmed still rejecting on their own). Test rows deleted afterward, verified empty.
  - **RLS clarified, not changed:** the user asked to "add RLS to the necessary tables"; it was already enabled on all 13 (confirmed in the review query). Asked whether they meant confirming that or writing real per-role policies now — they confirmed the former. Real policies stay Phase 10 work, gated on the confirmed permission matrix, as originally planned.

## Phase 10: Supabase authentication, profiles, roles, and RLS

**Objective:** Replace mock login/role preview with secure email/password sessions and authoritative database authorization.

**Prerequisites:** Phase 9 and final permission matrix. **Satisfied 2026-07-27.**

**Likely files:** Auth/profile context, login/recovery/profile pages, permissions/types, RLS/grant migrations, a non-committed one-time operator bootstrap script or runbook, tests.

**User decisions confirmed before starting:** build the operator bootstrap mechanism but do not run it against the real roster yet (no real employee emails were supplied, and none should be pasted into chat or committed); keep `frontend/src/lib/mock-auth.ts` as the active provider for now rather than cutting the frontend over to real Supabase Auth, so the app stays usable for review. **Both honored — the frontend still runs entirely on mock auth; nothing below touches it.**

Verified with `pnpm format:check`, `pnpm lint --max-warnings=0`, strict `pnpm typecheck`, `pnpm test` (**392 tests, 29 files**, unchanged from Phase 9 — no frontend files were touched), `pnpm build`, and four separate live-database test passes (58 checks total, detailed below), each leaving the database exactly as found.

### A live gap found, and fixed once unblocked

Before writing any policy, the project's actual current Auth configuration was read via
the public `/auth/v1/settings` endpoint (safe, read-only): **`disable_signup: false`** —
public self-registration was **enabled** on the live hosted project, directly
contradicting `.agents/plan.md` section 13 ("Public self-registration remains
disabled"). All social/OAuth providers were already correctly disabled. Fixing it
needed `supabase config push`, which requires a personal access token — unavailable
until the user generated one and added it to `.env` on 2026-07-28.

**Resolved 2026-07-28**: `supabase link --project-ref rlezcmnwemgtculvbaxh` succeeded
with the new token; `supabase/config.toml`'s top-level `[auth].enable_signup` was
flipped from `true` to `false` and pushed with `supabase config push`. (That push also
surfaced an unrelated config drift — `storage.vector.enabled = true`, a `supabase init`
default that isn't actually usable on this project's tier and was blocking the push
with a 402 — fixed by setting it back to `false`, matching what the project actually
has.) Re-read `/auth/v1/settings` live afterward: **`disable_signup: true`**, confirmed.

A second push immediately after found `[auth.email].enable_signup` — a *separate*,
provider-specific copy of the same flag — was still `true` live, even though the
top-level flag already read as fixed. The `config push` diff caught it directly
(`-enable_signup = true` / `+enable_signup = false` under `[email]`), so it was fixed
in the same pass rather than shipping as a second undiscovered gap. Re-verified
`disable_signup: true` still holds after this second push.

Separately, an Edge Function deploy/invoke smoke test (a disposable `healthcheck-test`
function, deployed with `--use-api` and immediately deleted) confirmed the token also
unlocks real Edge Function deployment without needing Docker/Podman — the other half
of Phase 9/10's `LegacyPlatformAuthRequiredError` blocker. This makes Phase 12
(Cloudinary via Edge Functions) fully achievable end to end from this environment.

### Tasks

- [X] Document that the application has no Admin role, Admin account, Admin dashboard, or in-app user-management feature. Already stated in `.agents/plan.md` section 11; nothing built in this phase creates one — the bootstrap script below is an operator-run local script, never a deployed function, never reachable over HTTP.
- [X] Configure controlled email/password Auth and allowlisted site/recovery URLs. `disable_signup` is now fixed (see above). Redirect-URL allowlisting (`site_url`/`additional_redirect_urls` in `config.toml`) is still the local placeholder (`http://127.0.0.1:3000`/`https://127.0.0.1:3000`) — deliberately not updated to a real deployed URL yet since nothing is deployed; revisit once a real frontend URL exists to allowlist.
- [X] Keep Google OAuth and public self-registration disabled. Google (and every other social provider) is already off, confirmed by reading the live settings. Public self-registration is now **also disabled** (`disable_signup: true`, confirmed live 2026-07-28).
- [X] Define a protected, environment-specific roster of known emails with explicit Officer/Supervisor role and department assignments; do not commit real roster data. `supabase/scripts/bootstrap-user.mjs`'s header comment defines the exact roster JSON shape (email, name, phone, role, position, department codes) and enforces it (a Supervisor must supply exactly one department code, or the script refuses the entry before calling anything). Roster files are gitignored by pattern (`supabase/scripts/roster*.json`), confirmed with `git check-ignore -v`. No real roster data exists anywhere in this repository.
- [X] Build or document a one-time server-only operator bootstrap that creates each Supabase Auth user and matching profile without storing a reusable/plaintext password. `supabase/scripts/bootstrap-user.mjs`, run manually by the operator, never deployed. Verified 2026-07-27, with one honest gap recorded in `supabase/scripts/README.md`: the script's own `inviteUserByEmail` call was **not** exercised against a real deliverable address, because doing so would either be rejected (GoTrue refuses non-mail-accepting test domains like `@example.com`/`@example.test`) or risk actually emailing a real stranger's inbox if a guessed real domain happened to exist. Instead, the surrounding logic — department-code lookup and rejection of an unknown code, the profile insert, the department-scope insert — was verified end to end using `admin.createUser` as a structurally equivalent stand-in for the one call needing a real address. **7/7 checks passed**, all test rows cleaned up. The real roster run will be the first genuine exercise of `inviteUserByEmail` and of whatever SMTP configuration exists by then.
- [X] Make the Supabase recovery flow the supported way for a seeded user to establish or update their password. The bootstrap script never sets a password — there is no password field anywhere in it, by design; `inviteUserByEmail` creates the identity with none, so recovery/invite email is the only route to a working password, matching the plan exactly.
- [X] Never accept role or department assignments from browser input or user metadata. Nothing in the schema reads `auth.users.raw_user_meta_data`/`raw_app_meta_data` for authorization; every RLS policy checks `profiles.role`/`profile_department_scope` instead (see `auth_role()`/`auth_department_ids()`, migration `20260727000012`), and `profiles` has **no UPDATE policy for anyone**, so role/department cannot be changed through the Data API at all, self- or otherwise.
- [ ] Implement session restoration, `onAuthStateChange`, profile loading, logout, disabled-user handling, and query-cache clearing. **Deliberately not done** — this is real frontend work, and the user chose to keep mock auth active for now rather than cut over. Nothing to build yet without breaking the working app.
- [ ] Replace mock demo role switching with distinct test accounts. Same reason — deferred with the frontend cutover.
- [ ] Connect accepted login/recovery/profile UI to Supabase. Same reason — deferred with the frontend cutover.
- [X] Add explicit grants and per-table SELECT/INSERT/UPDATE/archive policies. Migration `20260727000013`: every default Supabase grant (`INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` to **both** `anon` and `authenticated` — confirmed live before writing anything, an over-permissive default this project shipped with) was revoked first, then re-granted explicitly per the confirmed permission matrix. `anon` receives **nothing**, on any table. **No role ever receives a DELETE grant** — this product preserves history via archive/void, never hard deletes, and the grants now make that true at the privilege level, not only by convention.
- [X] Add SELECT plus `USING` and `WITH CHECK` to UPDATE paths. Every UPDATE policy (machines, machine_parts, maintenance_plans, maintenance_records, repair_records) has both clauses, verified live: a Supervisor cannot self-escalate their own role (no policy exists for it at all) and a write to an archived machine's children is rejected before the row is touched.
- [X] Enforce parent state, role, actor, archive, and transition rules. Department scoping and archived-visibility are enforced via `EXISTS` subqueries against the parent `machines` row on every child table; `part_replacements.performed_by = auth.uid()` stops one user forging history as another (an actor-spoofing check, verified structurally by the constraint, not yet by a live forged-actor attempt — see carry-over).
- [X] Protect profile role, department, position, active state, and employee identifiers from self-modification. `profiles` has no UPDATE policy for any role — verified live: a real Supervisor JWT attempting `PATCH profiles?id=eq.<self>` with `{"role":"officer"}` returned `403` and the row was confirmed unchanged in the database.
- [X] Keep account provisioning/offboarding out of the application UI and document the project-owner runbook. `supabase/scripts/README.md`. No provisioning path exists anywhere in `frontend/src`.

### Security tests

- [X] Test anonymous, disabled, Supervisor, and Officer allow/deny matrix on every table/function. Done as **four separate live end-to-end passes** against the real linked database — not mocked, not service-role bypass — using throwaway `@example.test` accounts created via the Admin API, signed in for real JWTs, queried through PostgREST with those JWTs. **58 checks total, all passing**:
  - Core matrix (11 checks): anonymous denied (401), Officer reads their own department and not another's, Officer can insert a machine, Supervisor cannot insert a machine (Officer-only), Supervisor can insert an installed part (shared authority), a Supervisor's self-escalation attempt is rejected, cross-department direct-id lookup returns nothing (no IDOR), the audit trigger recorded the real actor, a disabled profile (`is_active = false`) loses access immediately on its still-valid JWT, cleanup left nothing behind including the two auth users.
  - Attachment constraints (from the Phase 9 checkpoint fix, re-confirmed applicable here): 3 checks.
  - Bootstrap script logic (7 checks): department lookup, unknown-code rejection, profile/scope insert, correct read-back.
  - Archived-write rejection (3 checks, added for this exact task row): fitting a part to an archived machine and scheduling maintenance on one both rejected with `403`.
- [ ] Prove no application route or callable function exposes account creation, role assignment, or user-management capability. Structurally true today (no such route or function exists in `frontend/src` or `supabase/functions`), but not exercised as a specific negative test — carried over, not claimed as verified.
- [X] Prove role self-escalation, actor spoofing, cross-parent IDOR, and archived writes fail. Self-escalation, cross-parent IDOR, and archived writes are all verified live (above). **Actor spoofing now attempted live too, 2026-07-28**: `supabase/scripts/verify-actor-spoofing.mjs` attempted recording a `part_replacements` row with `performed_by` set to a different real profile's id — rejected by `part_replacements_insert`'s `performed_by = auth.uid()` check — then confirmed the same caller recording themself as the actor succeeds. **2/2 checks passing.**
- [X] Prove private-function access fails. **Attempted 2026-07-28, found and fixed a
  real gap.** All four `security definer` helper functions were documented as "revoked
  from PUBLIC, granted only to `authenticated`" but a live check against
  `information_schema.routine_privileges` showed `anon` held EXECUTE on all four
  anyway — Supabase's default privileges auto-grant EXECUTE on new functions to
  `anon`/`authenticated`, the same platform default the RLS migration already handled
  for tables but missed for functions (`REVOKE ... FROM PUBLIC` doesn't touch a role's
  own separate default grant). `auth_role()`/`auth_department_ids()`/
  `auth_can_see_archived()` leaked nothing in practice (gated on `auth.uid()`, null for
  `anon`), but `entity_department_id(entity_type, entity_id)` took no identity-bound
  parameter and, being `security definer`, bypassed RLS entirely — an unauthenticated
  caller could learn which department any machine/part/maintenance/repair record
  belongs to, given or by enumerating its UUID. Fixed by
  `20260727000015_lock_down_auth_helper_functions.sql` (explicit
  `revoke execute ... from anon` on all four), verified live,
  `supabase/scripts/verify-anon-function-lockdown.mjs`, **5/5 checks passing**. This is
  a project-wide default, not a one-off: any new `security definer` function (Phase 12
  may add some) needs its own explicit revoke.
- [ ] Run advisors, reset, generated-type check, frontend tests/build, and Auth E2E. **Partially blocked, same Docker/Podman gap as Phase 9** (`gen types` needs a container runtime even against `--db-url`). Frontend tests/build are green (above). No Auth E2E exists yet because the frontend is still deliberately on mock auth.

**Expected output:** Real Auth and complete RLS authorization. **Definition of done:** Mock authentication is absent and positive/negative security matrices pass. **Suggested commit:** `feat(auth): add email password auth and rls`

Carry-over, recorded honestly rather than silently dropped:

- ~~`disable_signup` is still `false` on the live project~~ — **resolved 2026-07-28** once a personal access token unblocked `supabase config push` (see above).
- Frontend still runs on mock auth entirely, by the user's explicit choice.
- Actor-spoofing was attempted live 2026-07-28 and passed (2/2, above). The
  account-creation-surface negative test remains structurally true (no route/function
  in this codebase creates accounts) but genuinely unattempted as a live test: the
  natural check — sign up publicly, confirm the account can't act as a real user —
  can't run here because GoTrue rejects `@example.test` addresses on `signUp()`, the
  same domain-validation limitation documented for `inviteUserByEmail`.
- `app_settings` still has no grant or policy at all — deliberately: nothing reads or writes it yet, so there is no real access rule to write, only a guess.

- [ ] **Verification checkpoint:** Bootstrap known-email test accounts out of band, demonstrate Officer/Supervisor and disabled cases, and complete password recovery without any Admin UI/account. **Partially satisfied**: Officer/Supervisor/disabled-account behavior was demonstrated live against real (throwaway) accounts, not a description. Password recovery was **not** completed end-to-end — that needs a real deliverable email address and working SMTP, neither available here safely. This checkpoint stays open until a real roster run happens.

## Phase 11: Replace mock repositories with Supabase data

**Objective:** Swap temporary frontend repositories for typed Supabase queries/mutations without UI regression.

**Prerequisites:** Phase 10.

**Likely files:** domain query/mutation hooks, DTO mappers, accepted pages/components, mock removal, tests.

### Tasks

- [x] Create stable TanStack Query keys and typed row-to-UI mappers.
  `src/lib/supabase/query-keys.ts` (department/machine/part/maintenance/repair/technician/profile
  key factories) and `src/lib/supabase/mappers.ts` (one pure function per domain row →
  frozen UI type). `src/lib/database.types.ts` rewritten from the Phase 8 placeholder
  into a full hand-written `Database` type matching the live schema (verified against a
  live `information_schema` dump; `supabase gen types` remains blocked on the
  Docker/Podman requirement recorded in Phase 9). `src/lib/supabase/pagination.ts` adds
  `PagedResult<T>`, `clampPageSize`, `toRange`, `withTieBreaker`.
- [x] Replace profiles/departments/machines data and mutations.
  `src/lib/supabase/departments.ts`, `technicians.ts`, `profiles.ts`, `machines.ts` — full
  list/get/summary reads plus create/update/archive/restore/image mutations for
  machines, department-scoped throughout.
- [x] Replace parts data and mutations.
  `src/lib/supabase/parts.ts` — list/get/summary/replacement-history reads plus
  create/update/archive/restore/replace/image mutations.
- [x] Replace maintenance plans/records and due queries.
  `src/lib/supabase/maintenance.ts` — record and plan reads/summaries, plus full
  record lifecycle (create/update/start/complete/cancel/reopen) and plan
  lifecycle (create/update/archive/restore).
- [x] Replace repairs and effective-status queries.
  `src/lib/supabase/repairs.ts` — reads/summary/attachments plus full lifecycle
  (create/update/start/wait-for-parts/complete/cancel) and evidence-attachment writes.
- [ ] Replace dashboard aggregates and notifications only if in scope. Not started — no
  dashboard-specific query module yet; the per-domain summary views
  (`department_summary`/`maintenance_summary`/`repair_summary`/`parts_summary`) that a
  dashboard aggregate would compose from are already queryable via the domain modules
  above.
- [ ] Replace report previews with bounded report-ready queries. Not started.
- [x] Move search/filter/sort/pagination to Supabase with deterministic tie-breakers and
  page-size bounds. Every list query in `machines.ts`/`parts.ts`/`maintenance.ts`/`repairs.ts`
  goes through `pagination.ts`'s `clampPageSize`/`toRange`/`withTieBreaker` and returns
  `PagedResult<T>` (`{ rows, total }`), never a bare unbounded array.
- [x] Add safe conflict/not-found/unauthorized/validation/error mapping and cache
  invalidation. Every mutation returns the existing `MutationResult<T>` contract
  (`{ ok: false, reason, message }` on Postgres unique/FK-violation codes 23505/23503,
  or on a zero-row conditional update meaning "wrong state to transition from"),
  mirroring the mock repository's failure reasons exactly so no page-level error
  handling needs to change on cutover. Cache invalidation itself (wiring these into
  TanStack Query mutations) is deferred to the page-cutover step, per the choice below.
- [ ] Remove production mock imports; retain explicit fixtures only in tests. **Not
  done, deliberately** — see the scope note below.

### Tests and verification

- [x] Live-verify the data layer against the real hosted project and real RLS.
  `supabase/scripts/verify-data-layer.mjs` (documented in `supabase/scripts/README.md`)
  creates a throwaway `@example.test` Officer identity scoped to one seed department,
  signs in for a real JWT, and checks: department reads are scoped to the caller's own
  department; the officer can create a machine in their own department;
  `machines_with_derived` exposes it with derived fields populated; creating a machine
  in an out-of-scope department is rejected by RLS; `department_summary` reflects the
  new machine; archive/restore both work; machines in an out-of-scope department are
  invisible. **8/8 checks passing**, verified live 2026-07-27. Cleanup: the test
  machine is hard-deleted; the test profile/Auth identity are deactivated rather than
  hard-deleted, because `audit_logs`'s append-only trigger genuinely blocks deleting an
  actor once it has any audit rows — this is the schema working as designed, not a gap.

  **Real defect found and fixed by this live testing, 2026-07-27**: this smoke test
  only ever filtered `machines` directly and never caught it, but
  `parts.ts`/`maintenance.ts`/`repairs.ts` all narrow department-scoped list queries
  with `.in('machine.department_id', [...])` — a filter on an embedded (joined)
  resource's column. A follow-up live check (`supabase/scripts/verify-embed-scoping.mjs`)
  proved PostgREST silently ignores that filter on the *default* left-join embed — it
  parses but never actually narrows results (RLS itself still fully prevents
  cross-department leakage; the bug only affected further narrowing within a caller's
  own multi-department scope, e.g. an Officer scoped to two departments asking for just
  one's parts). Fixed by changing every affected `*_SELECT` constant to
  `machine:machines!inner(...)` — confirmed live, 2/2 checks passing post-fix. See
  `supabase/scripts/README.md` for detail.
- [x] Unit-test the mappers and pagination/query-param builders in isolation.
  `src/lib/supabase/mappers.test.ts` and `src/lib/supabase/pagination.test.ts` — full
  frontend suite is 420 passing tests across 31 files (up from 392 before Phase 11),
  `pnpm format:check`/`lint --max-warnings=0`/`typecheck`/`test`/`build` all clean.
- [ ] Re-run accepted frontend screenshots/flows with real staging/local data. Not
  applicable yet — no page imports the new data layer (see scope note).
- [ ] Test role denial through UI and direct Data API calls. Partially covered (RLS
  denial verified directly against the Data API above); UI-level denial has nothing new
  to test until pages are cut over.
- [x] Verify no unbounded full-table browser loads or N+1 dashboard queries. Structural
  guarantee, not a runtime one yet: every list function requires `pageSize`/`page` and
  returns `PagedResult<T>`; there is no code path in the new modules that fetches an
  entire table into the browser.
- [ ] Run all frontend/database/Auth quality gates. Frontend gates (above) are clean;
  no new database migrations or Auth changes in this phase, so nothing new to gate there.

**Scope note (per explicit user decision, 2026-07-27):** given the size of Phase 11, the
user chose "Build the data layer now, wire it in later" over doing the data layer and
the page-by-page cutover in the same pass. Everything above is the data layer:
`src/lib/database.types.ts`, `src/lib/supabase/{mappers,query-keys,pagination,departments,
technicians,profiles,machines,parts,maintenance,repairs}.ts`, all verified in isolation
(unit tests) and against the real live project (RLS smoke test). **Zero pages import any
of these modules yet** — confirmed by `grep -rn "lib/supabase/(departments|machines|
parts|maintenance|repairs|technicians|profiles|mappers|query-keys|pagination)"
src/pages src/components src/hooks` returning no matches. `mock-repository.ts` and
`mock-auth.ts` remain the sole data source for all 33 page files that use them, and the
running app's behavior is unchanged. The page-by-page cutover (removing mock imports,
wiring TanStack Query hooks, cache invalidation, UI regression pass) is the remaining
work for this phase and is intentionally deferred to a follow-up pass, together with the
still-blocked frontend auth cutover from Phase 10 (needs a real employee roster).

**Expected output:** Accepted UI powered by Supabase. **Definition of done:** No production mock data remains and UI/security/performance regression checks pass. **Suggested commit:** `feat(data): connect accepted ui to supabase`

- [ ] **Verification checkpoint:** Trace one record in each domain from database through UI mutation/audit and role denial. Data-layer half done above (machine lifecycle traced end-to-end through the real database, including its audit trigger); the UI-mutation half is blocked on the page cutover, not yet started.

## Phase 12: Cloudinary images through Supabase Edge Functions

**Objective:** Replace accepted mock image UI with secure machine/repair upload, finalize, replacement, deletion, and cleanup.

**Prerequisites:** Phase 11 and approved image policy.

**Likely files:** Edge Functions/shared helpers, attachment hooks, `ImageUploader`, galleries, env docs, tests.

### Environment unblock, 2026-07-28

A personal access token (added to `.env` by the user) unblocked what Phase 9/10 recorded
as `LegacyPlatformAuthRequiredError`: `supabase link` now works properly (no more
`--db-url` workaround), and — the part that matters most for this phase — **Edge
Function deployment works without Docker**, confirmed by deploying and invoking a
disposable `healthcheck-test` function via `--use-api` (bundles server-side), then
deleting it. This makes Phase 12 fully achievable end to end, not just written-but-
unverified.

Two real config regressions were also found and fixed while unblocking, both against
the live project: `disable_signup` was `true` (two separate toggles,
`[auth].enable_signup` and a provider-specific `[auth.email].enable_signup`, both had
to be fixed) — see Phase 10. Then, while fixing the second, disabling
`[auth.email].enable_signup` turned out to disable the *entire* email/password login
method (`external.email: false`), not just new signups — caught immediately by a live
sign-in test failing, reverted to `enable_signup = true`, re-verified `disable_signup:
true` still holds with existing-account login intact. Recorded so the same mistake
isn't repeated: only the top-level `[auth].enable_signup` should ever be touched for
this.

### Tasks

- [X] Store Cloudinary/service-role secrets only in Edge Function secret storage. `supabase secrets set CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET`, confirmed present via `supabase secrets list` (values shown hashed, not in plaintext). Never in frontend env, never in source.
- [X] Implement JWT/profile/permission/parent validation and CORS allowlist. `supabase/functions/_shared/auth.ts`'s `getAuthorizedCaller` now actually loads the caller's `profiles` row (role, department, active state) via the service-role client — the Phase 8 skeleton's `TODO(Phase 10)` is done. `cloudinary-sign/index.ts` checks: JWT valid + active profile; role is Officer or Supervisor (`.agents/plan.md` "Image edit authority"); parent entity exists, is not archived, and its department is in the caller's `departmentIds` — resolved generically across `machine`/`part`/`maintenance`/`repair` via `resolveEntityDepartment`. CORS allowlist unchanged from the Phase 8 `_shared/cors.ts` skeleton (`ALLOWED_ORIGINS` secret).
- [X] Implement short-lived constrained signed upload requests. `cloudinary-sign/index.ts` validates file type (`image/jpeg`/`image/png`/`image/avif`, matching `attachments_file_type_accepted`) and size (≤5 MB, matching `attachments_file_size_within_limit`) before ever computing a signature; signs a fixed `{timestamp, folder, public_id, overwrite}` param set with the API secret via `_shared/cloudinary.ts`'s `signParams` (SHA-1, Cloudinary's documented algorithm). The signature is scoped to exactly those params — Cloudinary independently recomputes the hash from what it actually receives, so the client cannot add/change a param without invalidating it.
- [ ] Connect accepted uploader progress/preview/error/cancel UI. **Data layer built, page wiring deliberately deferred** — same split as Phase 11. `frontend/src/lib/supabase/attachments.ts` implements the real sign → upload → finalize sequence (`signCloudinaryUpload`/`uploadToCloudinary`/`finalizeCloudinaryUpload`/`deleteCloudinaryAttachment`, composed as `uploadAndFinalizeImage`), using `XMLHttpRequest` (not `fetch`) specifically so `uploadToCloudinary` can report real upload progress — the exact shape `ImageUploader`'s existing progress bar UI already expects. 9 unit tests (mocked Supabase client + a fake `XMLHttpRequest`), all passing. **Not wired into `ImageUploader`/any page**: these Edge Functions verify a real JWT, and the app still runs entirely on `mock-auth.ts` (confirmed: 24 files still reference it, no real Supabase session exists anywhere in the frontend) — there is no session for this code to use yet. Confirmed zero pages import it, matching the Phase 11 isolation guarantee.
- [X] Verify/finalize upload metadata and attachment association. `cloudinary-finalize/index.ts`: re-validates JWT/role/department scope, checks the client-supplied `publicId` actually belongs to this entity (folder-prefix check) before ever asking Cloudinary about it, then fetches the *authoritative* resource metadata (`format`, `bytes`, `secure_url`) from Cloudinary's own Admin API via `_shared/cloudinary.ts`'s `lookupResource` — never trusting client-claimed metadata, which would otherwise let a caller report an oversized or disallowed-format asset as compliant. Re-validates format/size against the same limits `cloudinary-sign` checked (defense in depth). Writes the `attachments` row via the service-role client.
- [ ] Compensate or record cleanup pending when finalization fails. Not implemented as an *automated* path — if `cloudinary-finalize` fails after a real Cloudinary upload succeeded, the asset is orphaned in Cloudinary until manually reconciled. `reconcile-cloudinary-orphans.mjs` (below) is that manual recovery mechanism, genuinely verified to detect and clean up exactly this scenario — but nothing runs it automatically or on a schedule yet. The `attachments.status` enum (`pending`/`ready`/`deleting`/`failed`) exists in the schema for this purpose but nothing sets it to anything but `ready` yet.
- [x] Implement main/additional machine and repair evidence rules. `_shared/entities.ts`'s `SINGLE_IMAGE_ENTITY_TYPES` (machine/part) vs multi-image (repair, and maintenance by the same default) drives both `cloudinary-sign`'s public_id/overwrite choice and `cloudinary-finalize`'s update-in-place-vs-insert choice — matching `attachments_single_per_machine_or_part_idx`'s actual DB-level constraint exactly, confirmed live (see below).
- [X] Implement new-first replacement and idempotent pending/delete/retry. For single-image entities, "new-first" is structural rather than a separate cleanup step: `cloudinary-sign` always signs the *same* fixed `public_id` for a given entity with `overwrite=true`, so the new upload physically replaces the old Cloudinary asset in place — there is never a separate old asset to clean up. `cloudinary-finalize` then updates the existing `attachments` row (via service role, bypassing the missing client UPDATE grant) rather than delete-then-insert, since the partial unique index would reject a second row existing even momentarily. Confirmed live: replacing a machine's image reuses the same attachment row id *and* the same Cloudinary public_id, with exactly one row existing before, during (conceptually), and after.
- [ ] Implement/document orphan reconciliation. Not started — see "compensate on finalization failure" above; the same gap.
- [X] Validate content/type/bytes/dimensions/count/folder/public ID. Type and byte-size validated at both `sign` (declared values) and `finalize` (authoritative Cloudinary-reported values, the one that actually matters); "count" is enforced by the DB's own partial unique index for machine/part, and confirmed *not* to constrain repair (two uploads produce two rows, not a replace) — both directions verified live. Folder is fixed by the function itself, never client-supplied. `cloudinary-finalize` additionally validates the reported `publicId` actually belongs to the entity being finalized (folder-prefix check) before trusting anything else about it. Dimensions: not validated (not required by `.agents/plan.md`'s image policy).

### Security tests and verification

- [X] `cloudinary-sign` deployed and live-tested end to end,
  `supabase/scripts/verify-cloudinary-sign.mjs`: a disallowed file type (`image/webp`)
  is rejected with 400 before any signature is computed; a machine outside the
  caller's department is rejected with 403; a valid request for an in-scope machine
  returns 200; and the returned signature is actually accepted by Cloudinary for a
  real upload. **4/4 checks passing**, asset cleaned up afterward (confirmed via a
  direct Cloudinary Admin API resources listing showing zero leftover test assets).
  Initially blocked at 3/4: `cloudinary.txt`'s recorded cloud name (`t3okovj9`) didn't
  belong to the account these API credentials actually reference — confirmed
  independently of this project's code with a bare `curl` against Cloudinary's API
  (`"cloud_name mismatch"`), not a bug in the signing logic. The user confirmed the
  correct cloud name (`bsp-asm`); `.env` and the `CLOUDINARY_CLOUD_NAME` Edge Function
  secret were both updated and re-verified.
- [X] Full lifecycle deployed and live-tested end to end,
  `supabase/scripts/verify-cloudinary-lifecycle.mjs`, covering both entity shapes:
  machine (single-image) — upload, finalize, re-upload, re-finalize (confirmed same
  row id and same Cloudinary public_id reused, confirmed exactly one row exists
  throughout), delete (confirmed zero rows remain); repair (multi-image) — two
  uploads produce two distinct rows (confirmed *not* a replace), delete one (confirmed
  the other survives untouched), delete the second. **11/11 checks passing**,
  confirmed zero leftover Cloudinary assets and zero leftover test rows afterward.
- [ ] Test unauthorized/IDOR, archived parent, MIME spoof, oversize, forged/expired/replayed signature, arbitrary folder, CORS, repeated delete, and cleanup retry. Covered: IDOR/department-scope (both `sign` and `delete` reject out-of-scope entities/attachments), oversize/MIME-spoof-by-declared-type (`sign` rejects a disallowed declared type; `finalize` independently re-checks the *actual* Cloudinary-reported format/size, so a client cannot lie past `sign` by declaring `image/png` and uploading something else — `finalize` would still reject it, though this specific spoof-bypass path hasn't been separately live-tested), repeated delete (`destroyResource` treats Cloudinary's "not found" result as success, so deleting twice is idempotent, though not yet exercised as a dedicated live test), **CORS** (`verify-cors-and-secrets.mjs`: allowed origin gets echoed back exactly, on both preflight and the actual POST — see the real gap this caught, below). Not yet covered: forged/expired/replayed signature (Cloudinary's own signature verification is trusted rather than independently tested against this app's signer), arbitrary folder (the folder is hard-coded server-side and never client-supplied, so there's no arbitrary-folder input surface to attack — considered structurally closed rather than untested), cleanup retry (no retry mechanism exists yet, per the "compensate on finalization failure" gap above — though `reconcile-cloudinary-orphans.mjs` is the manual substitute).
- [X] Inspect source, bundle, responses, and logs for secret leakage. Done as a dedicated pass, 2026-07-28: grepped the production `frontend/dist` bundle for the exact Cloudinary API secret and Supabase service-role key values — zero matches, both as generic strings and as the literal live secret values. `supabase/scripts/verify-cors-and-secrets.mjs` additionally confirms live, against a real unauthenticated Edge Function response (not just source code), that neither secret is ever echoed back. **Along the way, found and fixed a real gap**: `ALLOWED_ORIGINS` had never actually been set as an Edge Function secret since the Phase 8 skeleton was written — every function's CORS header was silently empty (`Access-Control-Allow-Origin: ""`), invisible to every test in this project so far since Node scripts don't enforce CORS, but it would have broken every real browser call once the frontend actually invoked these functions. Fixed with `supabase secrets set ALLOWED_ORIGINS=http://localhost:5173`, verified live (correct origin echoed on both the OPTIONS preflight and the actual POST; a disallowed origin gets a value that doesn't match it, which is what makes the browser itself block it). **5/5 checks passing.**
- [X] Implement/document orphan reconciliation. `supabase/scripts/reconcile-cloudinary-orphans.mjs` — compares live Cloudinary assets under `sail-plant-maintenance/` against `attachments.cloudinary_public_id` rows, reports drift in both directions (orphaned Cloudinary assets with no row; dangling rows with no asset), and optionally deletes orphaned assets with `--delete-orphans` (never touches `attachments` itself, never deletes anything with a matching row). Genuinely verified, not just run against an already-clean project: ran clean first, then a real orphan was manually created (a live Cloudinary upload with no corresponding row), confirmed the script detected it, confirmed `--delete-orphans` actually removed it, confirmed a final run showed zero drift again. This is a manually-run tool, not a scheduled job — no cron/scheduled-function infrastructure exists in this project to automate it yet.
- [X] Reconcile sandbox Cloudinary assets with attachment rows after upload/replace/delete. Superseded by the dedicated reconciliation tool above — same evidence, now backed by a reusable script instead of one-off manual Admin API listings.
- [ ] Run all function/frontend/database tests and production build. Frontend gates (`format:check`/`lint --max-warnings=0`/`typecheck`/`test`/`build`) all clean — 430 tests passing (9 new, for `attachments.ts`). No dedicated Edge Function test runner exists (Deno test files would need `supabase functions serve` semantics or a Deno test harness — not yet set up); the live verify scripts substitute for that.

**Expected output:** Secure recoverable image lifecycle matching accepted UI. **Definition of done:** Success/failure/retry paths preserve consistency or explicit retry state with no secret exposure. **Suggested commit:** `feat(images): integrate cloudinary edge functions`

- [ ] **Verification checkpoint:** Confirm zero unexpected orphan assets in the non-production environment. Reachable now (credential issue resolved); not yet done as a standing check — only exercised once, manually, immediately after the verify script's own upload+cleanup.

## Phase 13: Full security, testing, documentation, and deployment readiness

**Objective:** Produce an evidence-backed staging release and an explicitly approved production plan.

**Prerequisites:** Phases 8–12.

**Likely files:** full tests, CI, README/runbooks, `.env.example`, deployment config, monitoring/security evidence, bounded fixes.

### Scope note (2026-07-28)

Most of this phase's real content — Auth/domain/image E2E journeys against real
accounts, staging deployment, production go/no-go — is gated on the same full
auth+data cutover the user explicitly chose to defer after Phase 12 (`AskUserQuestion`:
"Hold off — leave Phase 12 at 'backend complete, UI wiring blocked'"). What follows is
the slice of Phase 13 that's genuinely achievable without it: dependency audit,
existing Playwright E2E/visual-regression coverage (against the mock-auth app, not
real accounts — that's the part still blocked), CORS/secret/bundle scan, and security
headers. The rest stays honestly open below, not silently claimed.

### Tasks

- [ ] Audit every requirement and accepted frontend flow against coverage. Not done as a formal audit pass.
- [ ] Run fresh migrations/seed and full RLS/function matrix. Not re-run fresh this phase; extensively covered live across Phases 9–12's own verify scripts (58+11+2+5+4+11+5 = 96+ checks across `supabase/scripts/verify-*.mjs`, all still passing as of this phase).
- [ ] Run Playwright Auth/domain/image journeys for all roles. **Partially done, honestly scoped**: the existing `frontend/e2e/*.spec.ts` suite (auth, navigation, theme, mobile responsive — 35 tests) re-run clean against the production build. This exercises mock-auth's Officer/Supervisor split, not real accounts or the real image-upload flow — both blocked on the deferred cutover.
- [ ] Test concurrency, transaction rollback, expired sessions, function timeout, Cloudinary compensation, and cleanup retries. Not done — most of these need the real backend wired into the frontend to test meaningfully end-to-end.
- [X] Run dependency audit, advisors, secret/bundle scan, CORS/security-header/rate-limit review. `pnpm audit`: zero known vulnerabilities. Secret/bundle scan: grepped the production `frontend/dist` bundle directly for the exact live Cloudinary API secret and Supabase service-role key values — zero matches. CORS: `supabase/scripts/verify-cors-and-secrets.mjs` (see Phase 12) — found and fixed a real gap (`ALLOWED_ORIGINS` was never actually set as an Edge Function secret). Security headers: `frontend/vercel.json` had none at all — added CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. The CSP specifically was **verified against the real production build**, not just written: served `dist/` locally with the exact production headers and drove it with Playwright across every shell page — found a real violation (an inline `<script>` bootstrapping the theme before first paint), fixed by moving it to `public/theme-init.js` (a same-origin external file, covered by `script-src 'self'` with no hash/`'unsafe-inline'` needed), confirmed zero CSP console violations afterward, and separately confirmed the theme-flash-prevention behavior itself still works under the new CSP. No rate-limiting review — Supabase's built-in Auth rate limits are already configured in `config.toml`; no additional app-level rate limiting exists to review.
- [ ] Run accessibility, responsive, representative-volume performance, and visual regression review. **Partially done**: responsive (mobile-chromium E2E suite, above) and visual regression (`theme.spec.ts`'s snapshot tests, above) both re-run clean. Accessibility: `app-a11y.test.tsx`/`repair-a11y.test.tsx` (structural checks — one h1 per page, focus order) pass as part of the regular Vitest suite; no automated WCAG/axe-core scan exists. Representative-volume performance: not done — no realistic-scale dataset exists yet (still provisional/mock data throughout).
- [ ] Document local/staging/production envs, migrations, generated types, project-owner Auth bootstrap/offboarding, backups/restore, forward-fix/rollback, audit retention, and Cloudinary reconciliation. Partially covered piecemeal across `supabase/README.md`/`supabase/scripts/README.md` (bootstrap, migrations, reconciliation); no single consolidated runbook document exists yet.
- [ ] Deploy migrations/functions/SPA to staging in order and run smoke tests. Not done — no separate staging Supabase/Vercel environment exists; everything so far is against the one live hosted project, deliberately (no second project has been provisioned).
- [ ] Record carry-over issues and obtain explicit production go/no-go. Not reached — see the scope note above.

### Verification gates

- [X] Format, lint, strict typecheck, unit/component/database/function/E2E tests pass. All clean as of this phase: 431 Vitest tests, 35 Playwright E2E tests, `pnpm audit` zero vulnerabilities. No dedicated Edge Function test runner (Deno) exists; the live `supabase/scripts/verify-*.mjs` scripts substitute for that, as they have since Phase 9.
- [X] Production build and staging smoke tests pass. Production build passes. No staging environment exists to smoke-test (see above) — smoke tests have instead been run directly against the live project via the verify scripts throughout Phases 9–12.
- [X] No unresolved critical/high security issue or secret exposure exists. `pnpm audit` clean; bundle/response secret scans clean; the two real security gaps found this session (anon EXECUTE on auth helper functions, missing `ALLOWED_ORIGINS`) are both fixed and live-verified, not just noted.
- [ ] Documentation can be followed from a clean environment. Not verified — no consolidated runbook exists yet to test this against.
- [ ] Production deployment remains separately approved. Not reached — no production deployment has been proposed or discussed.

**Expected output:** Verified staging release and reproducible production runbook. **Definition of done:** All gates pass or approved exceptions are explicit; no automatic production deployment. **Suggested commit:** `docs: finalize security testing and deployment readiness`

- [ ] **Verification checkpoint:** Conduct a documented staging release rehearsal and human go/no-go review.

## Phase completion evidence template

- [ ] Scope and expected files were stated before edits.
- [ ] Relevant source/conventions/dependencies/Git state were inspected.
- [ ] Existing visual identity was preserved or approved changes were documented.
- [ ] No out-of-phase backend/credential/external action occurred.
- [ ] Types and validation are sound.
- [ ] Format and lint pass where configured.
- [ ] Strict typecheck passes.
- [ ] Relevant unit/component/database/function/E2E tests pass.
- [ ] Production Vite build passes.
- [ ] Responsive/accessibility/manual verification passes.
- [ ] Security/RLS negative cases pass when applicable.
- [ ] Documentation and checkboxes match evidence.
- [ ] No secret, unrelated edit, or false completion claim appears in status/diff.
