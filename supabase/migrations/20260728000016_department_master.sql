-- Brings `departments` up to the full department master the frontend has carried since
-- Phase 2 (21 rows), rather than the 5-row subset `seed.sql` put in the live project.
--
-- Why a migration and not `seed.sql`: `seed.sql` only runs during `supabase db reset`,
-- which this project deliberately never runs against the live database
-- (`supabase/RUNBOOK.md`, "Migrations"). A data migration is the only mechanism that
-- actually reaches the live project. `seed.sql` is kept in sync with this file so a
-- from-scratch rebuild lands on the same master.
--
-- The immediate trigger: real user provisioning needs `PM` (Plate Mill), `CHM`,
-- `COB`, and `SP3` to all exist before a department scope can reference them, and only
-- three of those four did.
--
-- `head` stays 'TBD' for every row. The department master's official heads are still
-- unconfirmed (`.agents/plan.md` section 18 decision 2) and inventing plausible names
-- would put fiction in a production table. `is_active` defaults to true; deactivate
-- rather than delete if a unit turns out not to be in scope, because `machines` and
-- `profiles` both reference departments with `on delete restrict`.
--
-- Idempotent on `code`. Existing rows (COB, CC, CHM, SP2, SP3) keep their ids so
-- nothing already referencing them breaks; only `sort_order` is realigned, and for
-- those five it is already identical.

insert into public.departments (code, name, head, sort_order) values
  -- Coke ovens and coal chemicals
  ('COB',  'Coke Ovens',                  'TBD',  1),
  ('CC',   'Coal Chemicals',              'TBD',  2),
  ('CHM',  'Coal Handling',               'TBD',  3),
  -- Iron making
  ('SP2',  'Sinter Plant 2',              'TBD',  4),
  ('SP3',  'Sinter Plant 3',              'TBD',  5),
  ('BF',   'Blast Furnaces',              'TBD',  6),
  -- Steel making
  ('SMS2', 'Steel Melting Shop 2',        'TBD',  7),
  ('SMS3', 'Steel Melting Shop 3',        'TBD',  8),
  ('CCS',  'Continuous Casting Shop',     'TBD',  9),
  -- Rolling mills
  ('RSM',  'Rail & Structural Mill',      'TBD', 10),
  ('URM',  'Universal Rail Mill',         'TBD', 11),
  ('MM',   'Merchant Mill',               'TBD', 12),
  ('WRM',  'Wire Rod Mill',               'TBD', 13),
  ('BRM',  'Bar & Rod Mill',              'TBD', 14),
  ('PM',   'Plate Mill',                  'TBD', 15),
  -- Auxiliary units
  ('PP',   'Power Plants',                'TBD', 16),
  ('OP',   'Oxygen Plants',               'TBD', 17),
  ('RMP',  'Refractory Materials Plant',  'TBD', 18),
  ('FES',  'Foundry & Engineering Shops', 'TBD', 19),
  ('SGP',  'Slag Granulation Plant',      'TBD', 20),
  ('TMH',  'Traffic & Material Handling', 'TBD', 21)
on conflict (code) do update
  set name = excluded.name,
      sort_order = excluded.sort_order;
