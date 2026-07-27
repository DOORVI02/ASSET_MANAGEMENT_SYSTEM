-- Two fixes from the Phase 9 human checkpoint review (2026-07-27):
--
-- 1. `customer` was a pre-existing table on this hosted project, not created by any of
--    our migrations (confirmed: `supabase migration list` showed zero migrations before
--    this session's). It has no relationship to this product and the user asked for
--    anything irrelevant found during review to be removed.
--
-- 2. `attachments` stored only a delivery `url`, with no way to identify the asset for
--    deletion/replacement, and no lifecycle state — but `.agents/plan.md` section 14
--    explicitly requires "pending/deleting/failed lifecycle states and retryable
--    reconciliation to avoid orphaned assets", and Cloudinary's Admin API needs a
--    `public_id`, not a URL, to delete or replace an asset. Both were documented
--    requirements this schema had not actually implemented yet. `file_type` and
--    `file_size` also had no constraint tying them to the confirmed image policy
--    (JPEG/JPG, PNG, **and AVIF**, 5 MB) in `frontend/src/lib/image-policy.ts` — a
--    row with an unsupported MIME type or an oversized file could previously have been
--    inserted with no database-level objection at all.
--
-- None of this adds real Cloudinary upload/delete logic — that is still Phase 12. This
-- migration only makes the schema actually match what Phase 12's Edge Functions will
-- need to write to, and what the accepted frontend contract already promises.

drop table if exists public.customer;

create type public.attachment_status as enum ('pending', 'ready', 'deleting', 'failed');

alter table public.attachments
  add column cloudinary_public_id text,
  add column status public.attachment_status not null default 'ready';

comment on column public.attachments.cloudinary_public_id is
  'Cloudinary asset identifier, required to delete or replace the asset via the Admin API. Nullable until Phase 12''s finalize step sets it — a row with status = pending and no public_id is an upload that never finished.';

alter table public.attachments
  add constraint attachments_file_type_accepted
    check (file_type in ('image/jpeg', 'image/png', 'image/avif')),
  add constraint attachments_file_size_within_limit
    check (file_size <= 5242880);
