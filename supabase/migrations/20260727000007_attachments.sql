-- Cloudinary attachment metadata. Supabase stores metadata only — never image binaries
-- (.agents/plan.md section 14); the actual Cloudinary integration is Phase 12.
--
-- `entity_id` is a polymorphic reference across four tables (`machines`, `machine_parts`,
-- `maintenance_records`, `repair_records`), which Postgres cannot express as a single
-- native foreign key. A trigger validates that `entity_id` actually exists in the table
-- named by `entity_type` before every insert/update, so this is still a real integrity
-- constraint rather than an unchecked loose id.
--
-- One image per machine and one per part (decision 2026-07-26, "uploading replaces the
-- existing image") is enforced by a partial unique index. Repair evidence is
-- deliberately multiple (before/during/after shots), so it is excluded from that index.
-- Maintenance attachments have no confirmed single-vs-multiple decision in the accepted
-- UI, so they are left unconstrained rather than guessed at.

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null,
  entity_type public.attachment_entity_type not null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  url text not null,
  constraint attachments_file_size_positive check (file_size > 0)
);

create index attachments_entity_idx on public.attachments (entity_type, entity_id);

create unique index attachments_single_per_machine_or_part_idx
  on public.attachments (entity_type, entity_id)
  where entity_type in ('machine', 'part');

create function public.validate_attachment_entity()
returns trigger
language plpgsql
as $$
declare
  exists_row boolean;
begin
  case new.entity_type
    when 'machine' then
      select exists(select 1 from public.machines where id = new.entity_id) into exists_row;
    when 'part' then
      select exists(select 1 from public.machine_parts where id = new.entity_id) into exists_row;
    when 'maintenance' then
      select exists(select 1 from public.maintenance_records where id = new.entity_id) into exists_row;
    when 'repair' then
      select exists(select 1 from public.repair_records where id = new.entity_id) into exists_row;
  end case;

  if not exists_row then
    raise exception 'attachments.entity_id % does not exist in the % table', new.entity_id, new.entity_type;
  end if;

  return new;
end;
$$;

create trigger attachments_validate_entity
  before insert or update of entity_id, entity_type on public.attachments
  for each row execute function public.validate_attachment_entity();
