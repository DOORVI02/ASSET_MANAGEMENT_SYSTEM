-- Lets the UI resolve an actor id to a person's name.
--
-- `performed_by`, `uploaded_by`, `reported_by` and `assigned_to` are raw profile ids
-- throughout the schema, and every detail screen renders them as names. But
-- `profiles_select_own` (migration 20260727000013) restricts `profiles` to `id =
-- auth.uid()`, so a signed-in user could only ever resolve *their own* name — every other
-- actor rendered as a bare UUID. `frontend/src/lib/supabase/profiles.ts` recorded this as
-- needing "a dedicated security definer RPC"; this is that RPC.
--
-- Deliberately an RPC and not a widened SELECT policy. RLS is row-level: a policy granting
-- visibility of colleagues' profile rows would expose every column of those rows —
-- `phone`, `email`, `position`, `role` — when the requirement is a display name. This
-- returns two columns and nothing else, so the privacy widening is exactly as large as the
-- feature needs and no larger.
--
-- Visibility rule: a caller may resolve the name of anyone whose department scope overlaps
-- their own. That is the same boundary every other policy in this schema uses, so it adds
-- no new notion of "who can see whom". `auth_department_ids()` returns an empty array for a
-- deactivated caller, so a disabled account resolves nothing — consistent with every other
-- helper, and without depending on the token being revoked.

create function public.profile_display_names(p_ids uuid[])
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name
  from public.profiles p
  where p.id = any (p_ids)
    and exists (
      select 1
      from public.profile_department_scope s
      where s.profile_id = p.id
        and s.department_id = any (public.auth_department_ids())
    );
$$;

-- Same lockdown as migration 20260727000015. Supabase's default privileges grant EXECUTE on
-- new functions to PUBLIC, which includes `anon` — that migration existed solely because
-- this was missed for the auth helpers, and `anon` ended up able to call a security definer
-- function. Revoking here is not defensive boilerplate; it is the specific mistake this
-- project has already made once.
revoke execute on function public.profile_display_names(uuid[]) from public;
revoke execute on function public.profile_display_names(uuid[]) from anon;
grant execute on function public.profile_display_names(uuid[]) to authenticated;
