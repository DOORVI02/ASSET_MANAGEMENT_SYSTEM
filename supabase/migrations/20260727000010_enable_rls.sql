-- Enable RLS on every table reachable through the Data API, with **no policies yet**.
--
-- This is a Phase 9 task, not Phase 10: ".agents/plan.md" section 9 lists "Enable RLS
-- on every protected exposed table before Data API use" as schema-phase work, while the
-- actual per-table SELECT/INSERT/UPDATE policies, grants, and role/actor checks are
-- Phase 10. Enabling RLS with zero policies is deliberately the safe default in
-- between: every table is already fully locked down to `anon`/`authenticated` the
-- moment the Data API can reach it, rather than sitting open until Phase 10 lands.
-- `service_role` still bypasses RLS entirely, which is why the audit-log and
-- attachment-entity triggers added earlier enforce their rules independently of RLS.

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_department_scope enable row level security;
alter table public.technicians enable row level security;
alter table public.machines enable row level security;
alter table public.machine_parts enable row level security;
alter table public.part_replacements enable row level security;
alter table public.maintenance_plans enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.repair_records enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;
