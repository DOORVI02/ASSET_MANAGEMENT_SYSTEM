-- Non-secret, fictitious local fixtures. No real roster emails, no real machine data,
-- no real credentials (.agents/plan.md section 13: "Real roster emails and credentials
-- ... must not be committed in migrations, seed.sql, fixtures, or documentation").
--
-- Deliberately does not seed `profiles`: a profile row requires a matching `auth.users`
-- row, which only the one-time operator bootstrap (Phase 10) may create — seeding a
-- fake one here would be exactly the kind of shortcut plan.md section 13 rules out.
-- Everything below is reachable and useful without a signed-in user.

insert into public.departments (code, name, head, sort_order) values
  ('COB', 'Coke Ovens', 'TBD', 1),
  ('CC', 'Coal Chemicals', 'TBD', 2),
  ('CHM', 'Coal Handling', 'TBD', 3),
  ('SP2', 'Sinter Plant 2', 'TBD', 4),
  ('SP3', 'Sinter Plant 3', 'TBD', 5)
on conflict (code) do nothing;

insert into public.technicians (name) values
  ('R. Kumar'),
  ('S. Sharma'),
  ('A. Patel'),
  ('M. Singh'),
  ('T. Das')
on conflict do nothing;
