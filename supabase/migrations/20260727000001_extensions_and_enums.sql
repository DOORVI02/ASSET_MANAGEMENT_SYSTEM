-- Phase 9 foundation: extensions and shared enum types.
--
-- Enum values mirror frontend/src/lib/types.ts exactly. `maintenance_status` has no
-- `overdue` member: whether an open record is overdue is derived from `scheduled_date`
-- against the shared due-soon window (15 days, frontend/src/lib/maintenance-window.ts),
-- never stored (decision 2026-07-26).

create extension if not exists pgcrypto;

create type public.app_role as enum ('officer', 'supervisor');

create type public.machine_status as enum (
  'active',
  'inactive',
  'under_maintenance',
  'under_repair',
  'retired'
);

create type public.machine_type as enum (
  'motor',
  'pump',
  'compressor',
  'crane',
  'conveyor',
  'press',
  'mill',
  'blower',
  'lathe',
  'other'
);

create type public.maintenance_type as enum (
  'preventive',
  'corrective',
  'inspection',
  'lubrication',
  'calibration',
  'emergency'
);

create type public.maintenance_status as enum (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.recurrence_unit as enum ('days', 'weeks', 'months', 'years');

create type public.repair_status as enum (
  'reported',
  'in_progress',
  'waiting_for_parts',
  'completed',
  'cancelled'
);

create type public.attachment_entity_type as enum ('machine', 'part', 'maintenance', 'repair');

-- Shared `updated_at` maintenance trigger, reused by every table below that has the column.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
