-- Machines.
--
-- Deliberately not columns here, because they are derived (see the table in
-- frontend/README.md and the views/functions added in a later migration):
-- `Machine.department` (join to `departments.name`), `Machine.imageUrl` (the current
-- row in `attachments` for this machine), `Machine.lastMaintenanceDate` (max
-- `completed_date` over this machine's `maintenance_records`), and effective status
-- transitions into/out of `under_maintenance`/`under_repair` (a trigger recomputes
-- `status` itself from open maintenance/repair records — see migration 000005/6 — so
-- `status` remains a real column, but the application never sets it to
-- `under_maintenance`/`under_repair` directly).
--
-- `capacity`/`power_rating`/`voltage`/`weight` are the loose free-text technical fields
-- already in the frontend `Machine` type. They are separate from the conveyor
-- value+unit specification profile in `.agents/flow.md` section 9
-- (`MachineTechnicalProfile`), which stays out of scope until Phase 2C's engineering
-- sign-off lands — building that table now would be guessing at units and ranges the
-- plan explicitly says are still open.

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  department_id uuid not null references public.departments (id) on delete restrict,
  type public.machine_type not null,
  manufacturer text not null,
  model text not null,
  location text not null,
  status public.machine_status not null default 'active',
  installation_date date not null,
  next_maintenance_date date not null,
  description text not null default '',
  serial_number text,
  capacity text,
  power_rating text,
  voltage text,
  weight text,
  plant_area text,
  bay_section text,
  floor text,
  room_position text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machines_code_unique unique (code)
);

-- Case-insensitive, blank-exempt uniqueness, matching the frontend's repository-side
-- enforcement (Phase 3 evidence in .agents/phases.md).
create unique index machines_serial_number_unique_idx
  on public.machines (lower(serial_number))
  where serial_number is not null and serial_number <> '';

create index machines_department_id_idx on public.machines (department_id);
create index machines_status_idx on public.machines (status);
create index machines_is_archived_idx on public.machines (is_archived);
create index machines_next_maintenance_date_idx on public.machines (next_maintenance_date);

create trigger machines_set_updated_at
  before update on public.machines
  for each row execute function public.set_updated_at();
