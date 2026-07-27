-- Authorization helper functions, used by every RLS policy in the next migration.
--
-- Each is `security definer` so it can read `profiles`/`profile_department_scope` on
-- the caller's behalf without those tables' own RLS recursing into the very policy
-- that calls the function. Every one is `set search_path = public, pg_temp` (pinned,
-- per .agents/plan.md section 13's "search-path-pinned" requirement — an unpinned
-- security definer function is a classic privilege-escalation route if a caller could
-- ever influence `search_path`), revoked from `PUBLIC`, and granted only to
-- `authenticated`. All read `profiles` filtered to `is_active`, so a disabled account's
-- token stops being able to do anything the moment `is_active` flips to false — it does
-- not depend on the token itself being revoked.

create function public.auth_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create function public.auth_department_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(s.department_id), '{}')
  from public.profile_department_scope s
  where s.profile_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

-- Officers see archived machines/parts/history; Supervisors do not
-- (.agents/plan.md decision "Archived record visibility").
create function public.auth_can_see_archived()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role = 'officer' from public.profiles where id = auth.uid() and is_active),
    false
  );
$$;

-- Resolves the department a polymorphic `attachments`/`audit_logs` row belongs to, by
-- walking through whichever parent table `entity_type` names. Used by both tables'
-- SELECT policies so department scoping applies uniformly even though the row itself
-- carries no `department_id` column.
create function public.entity_department_id(p_entity_type text, p_entity_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_entity_type
    when 'machine' then (select department_id from public.machines where id = p_entity_id)
    when 'part' then (select m.department_id from public.machine_parts mp join public.machines m on m.id = mp.machine_id where mp.id = p_entity_id)
    when 'maintenance' then (select m.department_id from public.maintenance_records mr join public.machines m on m.id = mr.machine_id where mr.id = p_entity_id)
    when 'repair' then (select m.department_id from public.repair_records rr join public.machines m on m.id = rr.machine_id where rr.id = p_entity_id)
    else null
  end;
$$;

revoke all on function public.auth_role() from public;
revoke all on function public.auth_department_ids() from public;
revoke all on function public.auth_can_see_archived() from public;
revoke all on function public.entity_department_id(text, uuid) from public;

grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_department_ids() to authenticated;
grant execute on function public.auth_can_see_archived() to authenticated;
grant execute on function public.entity_department_id(text, uuid) to authenticated;
