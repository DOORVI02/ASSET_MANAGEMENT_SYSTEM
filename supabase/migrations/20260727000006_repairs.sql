-- Repair records.
--
-- `reported_by`/`assigned_to` stay free text, matching the frozen frontend contract —
-- unlike maintenance's `technician_id`, repairs were never built against the technician
-- roster (the assignee filter on `/repairs` searches free text, not a technician select).
-- Changing that is a product decision for a later phase, not something to guess at here.
--
-- `parts_used` is free text, not a relation to `machine_parts` — the same documented
-- carry-over as `maintenance_records.parts_used`.

create table public.repair_records (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete restrict,
  status public.repair_status not null default 'reported',
  reported_date date not null,
  start_date date,
  completed_date date,
  reported_by text not null,
  assigned_to text,
  description text not null,
  diagnosis text,
  resolution text,
  parts_used text,
  downtime_hours numeric(10, 2),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repair_records_downtime_non_negative check (downtime_hours is null or downtime_hours >= 0),
  -- `completeRepairRecord` in the mock repository rejects completion without both
  -- fields; enforced here so it cannot be bypassed by a direct write.
  constraint repair_records_completion_requires_diagnosis_and_resolution check (
    status <> 'completed' or (diagnosis is not null and resolution is not null)
  )
);

create index repair_records_machine_id_idx on public.repair_records (machine_id);
create index repair_records_status_idx on public.repair_records (status);
create index repair_records_reported_date_idx on public.repair_records (reported_date);

create trigger repair_records_set_updated_at
  before update on public.repair_records
  for each row execute function public.set_updated_at();
