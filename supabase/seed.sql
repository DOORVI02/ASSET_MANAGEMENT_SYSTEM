-- Non-secret, fictitious local fixtures. No real roster emails, no real machine data,
-- no real credentials (.agents/plan.md section 13: "Real roster emails and credentials
-- ... must not be committed in migrations, seed.sql, fixtures, or documentation").
--
-- Deliberately does not seed `profiles`: a profile row requires a matching `auth.users`
-- row, which only the one-time operator bootstrap (Phase 10) may create — seeding a
-- fake one here would be exactly the kind of shortcut plan.md section 13 rules out.
-- Everything below is reachable and useful without a signed-in user.
--
-- The department list must stay identical to
-- `migrations/20260728000016_department_master.sql`, which is what actually reaches the
-- live project (this file only runs during `supabase db reset`, which this project never
-- runs against the live database). Change both together, or a from-scratch rebuild will
-- land on a different master than the live one.

insert into public.departments (code, name, head, sort_order) values
  ('COB',  'Coke Ovens',                  'TBD',  1),
  ('CC',   'Coal Chemicals',              'TBD',  2),
  ('CHM',  'Coal Handling',               'TBD',  3),
  ('SP2',  'Sinter Plant 2',              'TBD',  4),
  ('SP3',  'Sinter Plant 3',              'TBD',  5),
  ('BF',   'Blast Furnaces',              'TBD',  6),
  ('SMS2', 'Steel Melting Shop 2',        'TBD',  7),
  ('SMS3', 'Steel Melting Shop 3',        'TBD',  8),
  ('CCS',  'Continuous Casting Shop',     'TBD',  9),
  ('RSM',  'Rail & Structural Mill',      'TBD', 10),
  ('URM',  'Universal Rail Mill',         'TBD', 11),
  ('MM',   'Merchant Mill',               'TBD', 12),
  ('WRM',  'Wire Rod Mill',               'TBD', 13),
  ('BRM',  'Bar & Rod Mill',              'TBD', 14),
  ('PM',   'Plate Mill',                  'TBD', 15),
  ('PP',   'Power Plants',                'TBD', 16),
  ('OP',   'Oxygen Plants',               'TBD', 17),
  ('RMP',  'Refractory Materials Plant',  'TBD', 18),
  ('FES',  'Foundry & Engineering Shops', 'TBD', 19),
  ('SGP',  'Slag Granulation Plant',      'TBD', 20),
  ('TMH',  'Traffic & Material Handling', 'TBD', 21)
on conflict (code) do nothing;

insert into public.technicians (name) values
  ('R. Kumar'),
  ('S. Sharma'),
  ('A. Patel'),
  ('M. Singh'),
  ('T. Das')
on conflict do nothing;
