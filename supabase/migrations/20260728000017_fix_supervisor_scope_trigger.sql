-- Fixes a real bypass in the supervisor single-department rule, found 2026-07-29 while
-- provisioning the first real accounts.
--
-- `enforce_supervisor_single_department_scope` (migration 20260727000002) is a
-- `before insert ... for each row` trigger that counts the rows already in
-- `profile_department_scope`. Inside a single multi-row `insert`, the rows earlier in the
-- same statement are not visible to that count — the statement's snapshot predates them.
-- So `insert into profile_department_scope values (sup, a), (sup, b)` passed: both
-- invocations counted zero. Only a row-at-a-time insert was ever actually checked, which
-- is why nothing caught this before — every previous caller happened to insert one row.
--
-- Moving to `after insert` closes it: after-row triggers fire once the statement's rows
-- are in place, so the count sees siblings from the same statement and `> 1` rejects the
-- batch. The check is deliberately `> 1` (total rows now present) rather than `>= 1`
-- (rows present before mine), which is the same rule stated in terms of the final state
-- instead of the insertion order.
--
-- Also newly covered: promoting an existing multi-department officer to supervisor via
-- `update profiles set role = 'supervisor'`. The old trigger only watched the scope
-- table, so that update left a supervisor holding several departments — the exact state
-- the rule exists to prevent, reachable without touching the guarded table at all.
--
-- flow.md section 6.2: a supervisor has exactly one department; an officer may have
-- several.

create or replace function public.enforce_supervisor_single_department_scope()
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

    if scope_count > 1 then
      raise exception 'A supervisor profile may have only one department in scope (found %).', scope_count;
    end if;
  end if;

  return null; -- after-row trigger: return value is ignored
end;
$$;

drop trigger profile_department_scope_supervisor_limit on public.profile_department_scope;

create trigger profile_department_scope_supervisor_limit
  after insert on public.profile_department_scope
  for each row execute function public.enforce_supervisor_single_department_scope();

-- The other direction: the role changing under an already-multi-department scope.
create function public.enforce_supervisor_scope_on_role_change()
returns trigger
language plpgsql
as $$
declare
  scope_count integer;
begin
  select count(*) into scope_count
  from public.profile_department_scope
  where profile_id = new.id;

  if scope_count > 1 then
    raise exception
      'Cannot set role to supervisor: profile % holds % departments in scope. Reduce it to one first.',
      new.id, scope_count;
  end if;

  return new;
end;
$$;

create trigger profiles_supervisor_scope_on_role_change
  after update of role on public.profiles
  for each row
  when (new.role = 'supervisor' and old.role <> 'supervisor')
  execute function public.enforce_supervisor_scope_on_role_change();

-- Same lockdown as migration 20260727000015: Supabase's default privileges grant EXECUTE
-- on new functions to PUBLIC, which includes `anon`. These are trigger functions and are
-- not usefully callable directly, but leaving them reachable is the gap that migration
-- had to come back and fix for the auth helpers.
revoke execute on function public.enforce_supervisor_scope_on_role_change() from public;
revoke execute on function public.enforce_supervisor_scope_on_role_change() from anon;
revoke execute on function public.enforce_supervisor_single_department_scope() from public;
revoke execute on function public.enforce_supervisor_single_department_scope() from anon;
