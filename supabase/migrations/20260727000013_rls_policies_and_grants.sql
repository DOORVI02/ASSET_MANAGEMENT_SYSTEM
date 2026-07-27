-- RLS policies and explicit Data API grants, implementing the confirmed permission
-- matrix in .agents/plan.md section 8.
--
-- Baseline: revoke every default privilege Supabase grants automatically on new tables
-- (INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER to *both* `anon` and
-- `authenticated`, confirmed by querying `information_schema.role_table_grants` against
-- the live project before writing this), then grant back only what the matrix actually
-- allows. `anon` gets nothing at all, on any table, ever — the "anonymous caller is
-- denied everywhere" requirement does not depend on RLS alone. No role ever receives a
-- DELETE grant: this product preserves history via archive/void, never hard deletes.
--
-- "TO authenticated" is never sufficient by itself (.agents/plan.md section 13) — every
-- policy below checks the caller's actual role and department scope via the
-- `security definer` helpers in the previous migration, and every UPDATE policy has
-- both `USING` and `WITH CHECK` so a row cannot be edited into a state the same policy
-- would have refused to create.

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

-- ── departments ──────────────────────────────────────────────────────────────────────
grant select on public.departments to authenticated;

create policy departments_select on public.departments
  for select to authenticated
  using (id = any (public.auth_department_ids()));

-- ── technicians ──────────────────────────────────────────────────────────────────────
-- A shared plant-wide roster, not department-scoped; any active application user may
-- read it to populate a technician picker. Written only by the project operator.
grant select on public.technicians to authenticated;

create policy technicians_select on public.technicians
  for select to authenticated
  using (public.auth_role() is not null);

-- ── profiles ─────────────────────────────────────────────────────────────────────────
-- Role, department, position, phone, and email are roster-controlled and not
-- self-editable (.agents/plan.md decision "Profile editability") — there is
-- deliberately no UPDATE policy here at all, for anyone. All profile changes happen
-- out-of-band through the operator bootstrap/roster process, using the service role,
-- which bypasses RLS entirely and needs no policy of its own.
grant select on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- ── profile_department_scope ─────────────────────────────────────────────────────────
grant select on public.profile_department_scope to authenticated;

create policy profile_department_scope_select_own on public.profile_department_scope
  for select to authenticated
  using (profile_id = auth.uid());

-- ── machines ─────────────────────────────────────────────────────────────────────────
-- "Add/edit/archive/retire machine master data": Officer only. Both roles may read,
-- department-scoped; Supervisors never see archived machines.
grant select, insert, update on public.machines to authenticated;

create policy machines_select on public.machines
  for select to authenticated
  using (
    department_id = any (public.auth_department_ids())
    and (not is_archived or public.auth_can_see_archived())
  );

create policy machines_insert_officer on public.machines
  for insert to authenticated
  with check (
    public.auth_role() = 'officer'
    and department_id = any (public.auth_department_ids())
  );

create policy machines_update_officer on public.machines
  for update to authenticated
  using (
    public.auth_role() = 'officer'
    and department_id = any (public.auth_department_ids())
  )
  with check (
    public.auth_role() = 'officer'
    and department_id = any (public.auth_department_ids())
  );

-- ── machine_parts ────────────────────────────────────────────────────────────────────
-- "Add/edit/archive installed parts": both roles (unlike machine master data).
grant select, insert, update on public.machine_parts to authenticated;

create policy machine_parts_select on public.machine_parts
  for select to authenticated
  using (
    exists (
      select 1 from public.machines m
      where m.id = machine_parts.machine_id
        and m.department_id = any (public.auth_department_ids())
        and (not m.is_archived or public.auth_can_see_archived())
    )
    and (not machine_parts.is_archived or public.auth_can_see_archived())
  );

create policy machine_parts_insert on public.machine_parts
  for insert to authenticated
  with check (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = machine_parts.machine_id
        and m.department_id = any (public.auth_department_ids())
        and not m.is_archived
    )
  );

create policy machine_parts_update on public.machine_parts
  for update to authenticated
  using (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = machine_parts.machine_id
        and m.department_id = any (public.auth_department_ids())
    )
  )
  with check (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = machine_parts.machine_id
        and m.department_id = any (public.auth_department_ids())
    )
  );

-- ── part_replacements ────────────────────────────────────────────────────────────────
-- Append-only history: no UPDATE or DELETE grant for anyone.
grant select, insert on public.part_replacements to authenticated;

create policy part_replacements_select on public.part_replacements
  for select to authenticated
  using (
    exists (
      select 1 from public.machine_parts mp
      join public.machines m on m.id = mp.machine_id
      where mp.id = part_replacements.part_id
        and m.department_id = any (public.auth_department_ids())
        and (not m.is_archived or public.auth_can_see_archived())
    )
  );

create policy part_replacements_insert on public.part_replacements
  for insert to authenticated
  with check (
    public.auth_role() in ('officer', 'supervisor')
    -- The actor field must name the actual caller, never an arbitrary profile —
    -- otherwise any writer could forge history as performed by someone else.
    and performed_by = auth.uid()
    and exists (
      select 1 from public.machine_parts mp
      join public.machines m on m.id = mp.machine_id
      where mp.id = part_replacements.part_id
        and m.department_id = any (public.auth_department_ids())
        and not m.is_archived
    )
  );

-- ── maintenance_plans ────────────────────────────────────────────────────────────────
-- "Define maintenance plans": both roles, confirmed 2026-07-26.
grant select, insert, update on public.maintenance_plans to authenticated;

create policy maintenance_plans_select on public.maintenance_plans
  for select to authenticated
  using (
    exists (
      select 1 from public.machines m
      where m.id = maintenance_plans.machine_id
        and m.department_id = any (public.auth_department_ids())
        and (not m.is_archived or public.auth_can_see_archived())
    )
  );

create policy maintenance_plans_insert on public.maintenance_plans
  for insert to authenticated
  with check (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = maintenance_plans.machine_id
        and m.department_id = any (public.auth_department_ids())
        and not m.is_archived
    )
  );

create policy maintenance_plans_update on public.maintenance_plans
  for update to authenticated
  using (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = maintenance_plans.machine_id
        and m.department_id = any (public.auth_department_ids())
    )
  )
  with check (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = maintenance_plans.machine_id
        and m.department_id = any (public.auth_department_ids())
    )
  );

-- ── maintenance_records ──────────────────────────────────────────────────────────────
grant select, insert, update on public.maintenance_records to authenticated;

create policy maintenance_records_select on public.maintenance_records
  for select to authenticated
  using (
    exists (
      select 1 from public.machines m
      where m.id = maintenance_records.machine_id
        and m.department_id = any (public.auth_department_ids())
        and (not m.is_archived or public.auth_can_see_archived())
    )
  );

create policy maintenance_records_insert on public.maintenance_records
  for insert to authenticated
  with check (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = maintenance_records.machine_id
        and m.department_id = any (public.auth_department_ids())
        and not m.is_archived
    )
  );

create policy maintenance_records_update on public.maintenance_records
  for update to authenticated
  using (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = maintenance_records.machine_id
        and m.department_id = any (public.auth_department_ids())
    )
  )
  with check (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = maintenance_records.machine_id
        and m.department_id = any (public.auth_department_ids())
    )
  );

-- ── repair_records ───────────────────────────────────────────────────────────────────
grant select, insert, update on public.repair_records to authenticated;

create policy repair_records_select on public.repair_records
  for select to authenticated
  using (
    exists (
      select 1 from public.machines m
      where m.id = repair_records.machine_id
        and m.department_id = any (public.auth_department_ids())
        and (not m.is_archived or public.auth_can_see_archived())
    )
  );

create policy repair_records_insert on public.repair_records
  for insert to authenticated
  with check (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = repair_records.machine_id
        and m.department_id = any (public.auth_department_ids())
        and not m.is_archived
    )
  );

create policy repair_records_update on public.repair_records
  for update to authenticated
  using (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = repair_records.machine_id
        and m.department_id = any (public.auth_department_ids())
    )
  )
  with check (
    public.auth_role() in ('officer', 'supervisor')
    and exists (
      select 1 from public.machines m
      where m.id = repair_records.machine_id
        and m.department_id = any (public.auth_department_ids())
    )
  );

-- ── attachments ──────────────────────────────────────────────────────────────────────
-- "Add/remove image UI entries": both roles. No UPDATE/DELETE grant here at all —
-- Phase 12's finalize/replace/delete workflow runs entirely through Edge Functions
-- under the service role, which bypasses RLS and needs no policy of its own.
--
-- Simplification, noted rather than silently made: this SELECT policy scopes by
-- department only, not by the parent's archived state (unlike every table above). The
-- one-image-per-machine/part replace-on-upload model means an archived entity's
-- attachment is a narrower edge case than its full maintenance/repair history; revisit
-- if a real need to hide archived-machine images from Supervisors surfaces.
grant select, insert on public.attachments to authenticated;

create policy attachments_select on public.attachments
  for select to authenticated
  using (public.entity_department_id(entity_type::text, entity_id) = any (public.auth_department_ids()));

create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (
    public.auth_role() in ('officer', 'supervisor')
    and uploaded_by = auth.uid()
    and public.entity_department_id(entity_type::text, entity_id) = any (public.auth_department_ids())
  );

-- ── audit_logs ───────────────────────────────────────────────────────────────────────
-- No INSERT grant for authenticated at all: every row is written by the audit triggers
-- added in the next migration, which run as their `security definer` owner and so do
-- not need — and must not have — a client-facing write policy. An audit entry whose
-- `entity_type` this project doesn't recognise (anything other than
-- machine/part/maintenance/repair) resolves to a null department and is denied by
-- default, rather than guessed at.
grant select on public.audit_logs to authenticated;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.entity_department_id(entity_type, entity_id) = any (public.auth_department_ids()));

-- ── app_settings ─────────────────────────────────────────────────────────────────────
-- Nothing reads or writes this table yet (Phase 8 note). No grant, no policy: it stays
-- fully inaccessible via the Data API until something actually needs it, at which point
-- the real access rule can be written against a real requirement instead of a guess.

-- ── Derived views ────────────────────────────────────────────────────────────────────
-- `security_invoker = true` (set when each view was created) makes every one of these
-- run under the querying role's own RLS on the underlying tables — they are a
-- convenience, not a privilege escalation. They still need their own SELECT grant,
-- since a grant on the base tables does not imply one on a view over them.
grant select on public.machines_with_derived to authenticated;
grant select on public.department_summary to authenticated;
grant select on public.maintenance_summary to authenticated;
grant select on public.repair_summary to authenticated;
grant select on public.parts_summary to authenticated;
