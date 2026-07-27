-- Fixes a real, confirmed security gap found by live testing 2026-07-27: despite
-- `20260727000012_auth_helper_functions.sql` documenting these four `security definer`
-- functions as "revoked from PUBLIC and granted only to authenticated", a live check
-- (`information_schema.routine_privileges` against the live project) showed `anon`
-- held EXECUTE on all four anyway.
--
-- Root cause: Supabase provisions new projects with default privileges that
-- auto-grant EXECUTE on new functions to `anon` and `authenticated` directly — the
-- same platform behavior that `20260727000013_rls_policies_and_grants.sql` already had
-- to work around for *tables* ("revoke all on all tables in schema public from anon"),
-- but that migration's function-level `revoke ... from public` never accounted for.
-- `REVOKE ... FROM PUBLIC` only removes the automatic-for-everyone default; it does
-- nothing to a role's own separate, explicit grant.
--
-- Impact of the gap: `auth_role()`/`auth_department_ids()`/`auth_can_see_archived()`
-- are all gated on `auth.uid()`, which is null for an anonymous caller, so they only
-- ever returned null/empty to `anon` — no data leaked in practice. `entity_department_id`
-- is the real one: it takes an arbitrary `(entity_type, entity_id)` pair with no
-- identity check at all, and being `security definer` it bypasses RLS entirely — an
-- unauthenticated caller could learn which department any machine/part/maintenance/
-- repair record belongs to, given (or by enumerating) its UUID.

revoke execute on function public.auth_role() from anon;
revoke execute on function public.auth_department_ids() from anon;
revoke execute on function public.auth_can_see_archived() from anon;
revoke execute on function public.entity_department_id(text, uuid) from anon;
