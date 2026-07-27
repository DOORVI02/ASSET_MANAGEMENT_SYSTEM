-- Installed machine parts and their replacement history.
--
-- Parts are installed components, not stock inventory (decision 2026-07-25): no
-- minimum-stock levels, stock states, suppliers, unit costs, or restock dates exist
-- here, matching the frontend `MachinePart` contract exactly.
--
-- Not columns, because they are derived: `machineName`/`machineCode` (join to
-- `machines`), and `PartLifeState` (`ok`/`due_soon`/`overdue`/`unknown`, computed from
-- `fitted_date` + `expected_life_months` against the shared 15-day window — see the
-- views/functions migration).

create table public.machine_parts (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete restrict,
  part_code text not null,
  part_name text not null,
  category text not null,
  serial_number text,
  quantity numeric(10, 2) not null,
  unit text not null,
  position_on_machine text not null,
  fitted_date date not null,
  expected_life_months integer,
  notes text not null default '',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machine_parts_quantity_positive check (quantity > 0),
  constraint machine_parts_expected_life_positive
    check (expected_life_months is null or expected_life_months > 0)
);

-- Case-insensitive, blank-exempt uniqueness across *all* parts (not just this
-- machine's), matching the frontend's repository-side enforcement.
create unique index machine_parts_serial_number_unique_idx
  on public.machine_parts (lower(serial_number))
  where serial_number is not null and serial_number <> '';

create index machine_parts_machine_id_idx on public.machine_parts (machine_id);
create index machine_parts_is_archived_idx on public.machine_parts (is_archived);
create index machine_parts_fitted_date_idx on public.machine_parts (fitted_date);

create trigger machine_parts_set_updated_at
  before update on public.machine_parts
  for each row execute function public.set_updated_at();

-- `machine_id` is left off this table on purpose even though the frontend
-- `PartReplacement` type carries it: it is fully derivable via `part_id`, and a part
-- can never move to a different machine, so storing it again would only be a second
-- copy of the same fact to keep in sync.
create table public.part_replacements (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.machine_parts (id) on delete restrict,
  replaced_on date not null,
  reason text not null,
  previous_serial_number text,
  new_serial_number text,
  performed_by uuid not null references public.profiles (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

create index part_replacements_part_id_idx on public.part_replacements (part_id);
