-- Automatic audit logging for the four core mutable entities.
--
-- Deliberately trigger-driven rather than a client-side "and also write an audit row"
-- convention: a client is not trusted to remember every time, and `audit_logs` has no
-- INSERT policy for `authenticated` at all (see the previous migration) — this is the
-- only path by which a row can ever get in. `security definer` lets the trigger insert
-- into a table the invoking role has no grant on; `auth.uid()` still resolves to the
-- real caller's id inside the function body, so the actor is never spoofable through
-- this path — it is never taken from a request parameter.
--
-- Best-effort, not blocking: a write performed by the service role or during migrations
-- has no caller profile, and the trigger skips logging rather than raise, so it can
-- never break the write that triggered it. `to_jsonb(...) ->> 'status'` reads a
-- `status` column generically across differently-shaped rows (returning null where one
-- doesn't exist, e.g. `machine_parts`) rather than assuming every audited table has one.

create function public.log_entity_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  entity_type_value text := tg_argv[0];
  action_value text;
  changes_value text;
  old_status text;
  new_status text;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor) then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    action_value := entity_type_value || '_created';
    changes_value := 'Created.';
  else
    old_status := to_jsonb(old) ->> 'status';
    new_status := to_jsonb(new) ->> 'status';
    if old_status is not null and old_status is distinct from new_status then
      action_value := entity_type_value || '_status_changed';
      changes_value := format('Status changed from %s to %s.', old_status, new_status);
    else
      action_value := entity_type_value || '_updated';
      changes_value := 'Record updated.';
    end if;
  end if;

  insert into public.audit_logs (entity_id, entity_type, action, performed_by, changes)
  values (coalesce(new.id, old.id), entity_type_value, action_value, actor, changes_value);

  return coalesce(new, old);
end;
$$;

create trigger machines_audit
  after insert or update on public.machines
  for each row execute function public.log_entity_change('machine');

create trigger machine_parts_audit
  after insert or update on public.machine_parts
  for each row execute function public.log_entity_change('part');

create trigger maintenance_records_audit
  after insert or update on public.maintenance_records
  for each row execute function public.log_entity_change('maintenance');

create trigger repair_records_audit
  after insert or update on public.repair_records
  for each row execute function public.log_entity_change('repair');
