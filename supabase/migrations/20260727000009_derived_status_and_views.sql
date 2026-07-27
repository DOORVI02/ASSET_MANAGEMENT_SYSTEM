-- Effective machine status derivation, shared due/life-state functions, and
-- security-invoker report/dashboard views.
--
-- Views are `security_invoker` (Postgres 15+ / Supabase default) so they run under the
-- querying user's own RLS, not the view owner's — a view is not a privilege escalation
-- path. RLS policies themselves are Phase 10; these views simply select from tables
-- that currently have no policies, so until Phase 10 they return nothing to anyone
-- except the service role.

-- ── Effective machine status ────────────────────────────────────────────────────────
-- Mirrors `recomputeMachineStatus` in frontend/src/lib/mock-repository.ts exactly: an
-- open repair outranks an open maintenance record; completing/cancelling the last open
-- record returns the machine to `active`; any other status (inactive/retired) is left
-- alone. Archived machines are skipped, matching the mock.
create function public.recompute_machine_status(p_machine_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  current_status public.machine_status;
  machine_is_archived boolean;
  has_open_repair boolean;
  has_open_maintenance boolean;
  next_status public.machine_status;
begin
  select status, is_archived into current_status, machine_is_archived
  from public.machines
  where id = p_machine_id;

  if current_status is null or machine_is_archived then
    return;
  end if;

  select exists(
    select 1 from public.repair_records
    where machine_id = p_machine_id and status not in ('completed', 'cancelled')
  ) into has_open_repair;

  select exists(
    select 1 from public.maintenance_records
    where machine_id = p_machine_id and status in ('scheduled', 'in_progress')
  ) into has_open_maintenance;

  next_status := current_status;
  if has_open_repair then
    next_status := 'under_repair';
  elsif has_open_maintenance then
    next_status := 'under_maintenance';
  elsif current_status in ('under_repair', 'under_maintenance') then
    next_status := 'active';
  end if;

  if next_status <> current_status then
    update public.machines set status = next_status where id = p_machine_id;
  end if;
end;
$$;

create function public.trigger_recompute_machine_status()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_machine_status(coalesce(new.machine_id, old.machine_id));
  -- Return value is ignored for an AFTER trigger; explicit null for clarity.
  return null;
end;
$$;

create trigger maintenance_records_recompute_status
  after insert or update of status or delete on public.maintenance_records
  for each row execute function public.trigger_recompute_machine_status();

create trigger repair_records_recompute_status
  after insert or update of status or delete on public.repair_records
  for each row execute function public.trigger_recompute_machine_status();

-- ── Shared due/life-state logic ─────────────────────────────────────────────────────
-- One function behind both the maintenance-record and machine-level due states, so
-- "due soon" and "overdue" can never mean something different depending on which
-- surface computed it. `p_is_open` lets the caller decide what "open" means for its own
-- row (a maintenance record: `scheduled`/`in_progress`; a machine: `status = 'active'`).
create function public.due_state(p_date date, p_is_open boolean)
returns text
language sql
stable
as $$
  select case
    when not p_is_open or p_date is null then 'not_applicable'
    when p_date < current_date then 'overdue'
    when p_date <= current_date + 15 then 'due_soon'
    else 'ok'
  end;
$$;

-- Mirrors `replacementDueDate` + `partLifeState` in frontend/src/lib/part-life.ts.
create function public.part_replacement_due_date(p_fitted_date date, p_expected_life_months integer)
returns date
language sql
immutable
as $$
  select case
    when p_expected_life_months is null or p_expected_life_months <= 0 then null
    else p_fitted_date + make_interval(months => p_expected_life_months)
  end;
$$;

create function public.part_life_state(p_fitted_date date, p_expected_life_months integer)
returns text
language sql
stable
as $$
  select case
    when public.part_replacement_due_date(p_fitted_date, p_expected_life_months) is null then 'unknown'
    when public.part_replacement_due_date(p_fitted_date, p_expected_life_months) < current_date then 'overdue'
    when public.part_replacement_due_date(p_fitted_date, p_expected_life_months) <= current_date + 15 then 'due_soon'
    else 'ok'
  end;
$$;

-- ── Machines with their derived display fields ──────────────────────────────────────
create view public.machines_with_derived
with (security_invoker = true) as
select
  m.*,
  d.name as department_name,
  d.code as department_code,
  (
    select max(mr.completed_date)
    from public.maintenance_records mr
    where mr.machine_id = m.id and mr.status = 'completed'
  ) as last_maintenance_date,
  public.due_state(m.next_maintenance_date, m.status = 'active') as due_state,
  (
    select a.url
    from public.attachments a
    where a.entity_type = 'machine' and a.entity_id = m.id
    limit 1
  ) as image_url
from public.machines m
join public.departments d on d.id = m.department_id;

-- ── Department dashboard summary ────────────────────────────────────────────────────
-- Matches frontend/src/lib/types.ts `DepartmentSummary` exactly. `due_soon`/`overdue`
-- are counted only among active machines, matching `DashboardPage`'s own predicate
-- (a machine already under maintenance/repair is not separately "due").
create view public.department_summary
with (security_invoker = true) as
select
  d.id as department_id,
  count(m.id) as total,
  count(*) filter (where m.status = 'active') as active,
  count(*) filter (where m.status = 'inactive') as inactive,
  count(*) filter (where m.status = 'under_maintenance') as under_maintenance,
  count(*) filter (where m.status = 'under_repair') as under_repair,
  count(*) filter (where m.status = 'retired') as retired,
  count(*) filter (
    where m.status = 'active' and public.due_state(m.next_maintenance_date, true) = 'due_soon'
  ) as due_soon,
  count(*) filter (
    where m.status = 'active' and public.due_state(m.next_maintenance_date, true) = 'overdue'
  ) as overdue
from public.departments d
left join public.machines m on m.department_id = d.id and not m.is_archived
group by d.id;

-- ── Maintenance summary ──────────────────────────────────────────────────────────────
-- Matches `MaintenanceSummary`. `due_soon`/`overdue` only apply to open records — see
-- the `due_state` comment on why `maintenance_status` has no `overdue` member.
create view public.maintenance_summary
with (security_invoker = true) as
select
  m.department_id,
  count(*) filter (where mr.status = 'scheduled') as scheduled,
  count(*) filter (where mr.status = 'in_progress') as in_progress,
  count(*) filter (where mr.status = 'completed') as completed,
  count(*) filter (where mr.status = 'cancelled') as cancelled,
  count(*) filter (
    where public.due_state(mr.scheduled_date, mr.status in ('scheduled', 'in_progress')) = 'due_soon'
  ) as due_soon,
  count(*) filter (
    where public.due_state(mr.scheduled_date, mr.status in ('scheduled', 'in_progress')) = 'overdue'
  ) as overdue
from public.maintenance_records mr
join public.machines m on m.id = mr.machine_id and not m.is_archived
group by m.department_id;

-- ── Repair summary ───────────────────────────────────────────────────────────────────
create view public.repair_summary
with (security_invoker = true) as
select
  m.department_id,
  count(*) filter (where rr.status = 'reported') as reported,
  count(*) filter (where rr.status = 'in_progress') as in_progress,
  count(*) filter (where rr.status = 'waiting_for_parts') as waiting_for_parts,
  count(*) filter (where rr.status = 'completed') as completed,
  count(*) filter (where rr.status = 'cancelled') as cancelled,
  coalesce(sum(rr.downtime_hours), 0) as downtime_hours
from public.repair_records rr
join public.machines m on m.id = rr.machine_id and not m.is_archived
group by m.department_id;

-- ── Installed-parts summary ──────────────────────────────────────────────────────────
create view public.parts_summary
with (security_invoker = true) as
select
  m.department_id,
  count(mp.id) as total,
  count(distinct mp.machine_id) as machines_with_parts,
  count(distinct mp.category) as categories,
  count(*) filter (
    where public.part_life_state(mp.fitted_date, mp.expected_life_months) = 'due_soon'
  ) as due_soon,
  count(*) filter (
    where public.part_life_state(mp.fitted_date, mp.expected_life_months) = 'overdue'
  ) as overdue
from public.machine_parts mp
join public.machines m on m.id = mp.machine_id and not m.is_archived
where not mp.is_archived
group by m.department_id;
