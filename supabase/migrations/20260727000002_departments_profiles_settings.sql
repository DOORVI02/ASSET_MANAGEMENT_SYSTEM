-- Departments, profiles, department scope, and a generic settings table.
--
-- `departments.head`, `is_active`, and `sort_order` are provisional: the official
-- department master (codes, names, order, active state, heads) is still unconfirmed
-- per .agents/plan.md section 18 decision 2. Proceeding with schema now was an explicit
-- user decision 2026-07-27 — swapping the real master in later is a data change, not a
-- schema change.
--
-- `profiles.department_id` is the caller's single primary/home department (required for
-- a Supervisor, who has exactly one). `profile_department_scope` is the *set* of
-- departments a caller may read — for a Supervisor this is always exactly one row,
-- enforced below by trigger; for an Officer it is their associated departments. This
-- normalizes the frontend's `UserProfile.departmentScope: string[]` (department *names*)
-- into a real many-to-many over department ids, which
-- `frontend/src/lib/department-scope.ts` already flagged as Phase 9 work.
--
-- Deliberately not stored, because they are derived: `Department.machineCount` (a query
-- over `machines`, not a column — Phase 2D already made this mistake once and fixed it),
-- `UserProfile.avatarInitials` (computed from `name` in the UI), and
-- `UserProfile.lastLogin` (Supabase Auth already tracks `auth.users.last_sign_in_at`;
-- Phase 11 reads it from there rather than duplicating it here).

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  head text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_code_unique unique (code),
  constraint departments_name_unique unique (name)
);

create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  name text not null,
  email text not null,
  phone text not null,
  role public.app_role not null,
  position text not null,
  department_id uuid not null references public.departments (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_department_id_idx on public.profiles (department_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.profile_department_scope (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (profile_id, department_id)
);

create index profile_department_scope_department_id_idx
  on public.profile_department_scope (department_id);

-- A Supervisor has exactly one department (flow.md section 6.2); an Officer may have
-- several. This enforces the Supervisor half of that rule at the data layer rather than
-- trusting every future write path to remember it.
create function public.enforce_supervisor_single_department_scope()
returns trigger
language plpgsql
as $$
declare
  caller_role public.app_role;
  scope_count integer;
begin
  select role into caller_role from public.profiles where id = new.profile_id;

  if caller_role = 'supervisor' then
    select count(*) into scope_count
    from public.profile_department_scope
    where profile_id = new.profile_id;

    if scope_count >= 1 then
      raise exception 'A supervisor profile may have only one department in scope.';
    end if;
  end if;

  return new;
end;
$$;

create trigger profile_department_scope_supervisor_limit
  before insert on public.profile_department_scope
  for each row execute function public.enforce_supervisor_single_department_scope();

-- Generic key/value configuration, e.g. a future override of the 15-day due-soon
-- window currently hard-coded in frontend/src/lib/maintenance-window.ts. Empty until
-- something needs it; no code reads this table yet.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();
