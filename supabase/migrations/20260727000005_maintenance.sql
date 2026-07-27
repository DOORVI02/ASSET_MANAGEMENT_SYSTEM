-- Technician roster, recurring maintenance plans, and performed/scheduled records.
--
-- `technicians` is a lightweight roster separate from `profiles`: floor technicians who
-- perform maintenance are not necessarily Officer/Supervisor application users, matching
-- `frontend/src/lib/mock-data.ts`'s standalone `Technician` fixture.
--
-- Not columns: `MaintenancePlan.nextDueDate` (derived from `last_completed_date`, or
-- `created_at` if never completed, plus the interval — never stored, so it cannot
-- disagree with the records that satisfy it) and `MaintenanceRecord`'s due state
-- (`ok`/`due_soon`/`overdue`/`not_applicable`, derived from `scheduled_date` against the
-- shared 15-day window). Both are added as functions in a later migration.
--
-- `MaintenanceStatus` has no `overdue` member — see the enum comment in migration 000001.

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete restrict,
  type public.maintenance_type not null,
  description text not null,
  interval_value integer not null,
  interval_unit public.recurrence_unit not null,
  technician_id uuid references public.technicians (id) on delete restrict,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  last_completed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_plans_interval_positive check (interval_value > 0)
);

create index maintenance_plans_machine_id_idx on public.maintenance_plans (machine_id);
create index maintenance_plans_is_archived_idx on public.maintenance_plans (is_archived);

create trigger maintenance_plans_set_updated_at
  before update on public.maintenance_plans
  for each row execute function public.set_updated_at();

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete restrict,
  plan_id uuid references public.maintenance_plans (id) on delete restrict,
  type public.maintenance_type not null,
  status public.maintenance_status not null default 'scheduled',
  scheduled_date date not null,
  completed_date date,
  technician_id uuid not null references public.technicians (id) on delete restrict,
  description text not null,
  findings text,
  actions text,
  -- Free text, not a relation to `machine_parts`: linking a record to specific fitted
  -- parts is a real future enhancement, deliberately not attempted here (matches the
  -- frontend contract's documented carry-over).
  parts_used text,
  duration_hours numeric(10, 2),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_records_duration_non_negative check (duration_hours is null or duration_hours >= 0),
  -- Linear plus reopen: a completed/cancelled record has a completed_date only when
  -- completed; scheduled/in_progress records never do. Reopening clears it, matching
  -- `reopenMaintenanceRecord` in the mock repository.
  constraint maintenance_records_completed_date_matches_status check (
    (status = 'completed' and completed_date is not null)
    or (status <> 'completed')
  )
);

create index maintenance_records_machine_id_idx on public.maintenance_records (machine_id);
create index maintenance_records_plan_id_idx on public.maintenance_records (plan_id);
create index maintenance_records_status_idx on public.maintenance_records (status);
create index maintenance_records_scheduled_date_idx on public.maintenance_records (scheduled_date);

create trigger maintenance_records_set_updated_at
  before update on public.maintenance_records
  for each row execute function public.set_updated_at();
