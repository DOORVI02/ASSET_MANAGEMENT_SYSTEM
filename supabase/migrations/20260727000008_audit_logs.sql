-- Append-only audit log. `entity_type` stays free text rather than the narrower
-- `attachment_entity_type` enum, because audit events cover far more than attachments
-- (profile role changes, specification edits, archive/restore, maintenance reopen, …).
--
-- The insert-only rule is enforced by trigger, not only by RLS/grants (added in
-- Phase 10): RLS does not apply to the service-role connection Edge Functions use, so a
-- trigger is the only thing that actually stops an audit row from being altered or
-- removed after the fact, regardless of which role holds the connection.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null,
  entity_type text not null,
  action text not null,
  performed_by uuid not null references public.profiles (id) on delete restrict,
  performed_at timestamptz not null default now(),
  changes text not null
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_performed_at_idx on public.audit_logs (performed_at);

create function public.forbid_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only: % is not permitted', tg_op;
end;
$$;

create trigger audit_logs_forbid_update
  before update on public.audit_logs
  for each row execute function public.forbid_audit_log_mutation();

create trigger audit_logs_forbid_delete
  before delete on public.audit_logs
  for each row execute function public.forbid_audit_log_mutation();
