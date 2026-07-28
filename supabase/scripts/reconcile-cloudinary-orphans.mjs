#!/usr/bin/env node
/**
 * Operational reconciliation: compares Cloudinary assets under the
 * `sail-plant-maintenance/` prefix against `attachments.cloudinary_public_id` rows,
 * and reports two kinds of drift:
 *
 *  - Orphaned Cloudinary assets: an asset exists in Cloudinary with no `attachments`
 *    row pointing at it. Expected cause: `cloudinary-finalize` was never called after
 *    a successful upload (browser closed, network failure, crash) — the gap recorded
 *    in `.agents/phases.md` Phase 12 as "compensate on finalization failure", not yet
 *    automated.
 *  - Dangling attachment rows: an `attachments` row references a
 *    `cloudinary_public_id` that no longer exists in Cloudinary. Expected cause: the
 *    Cloudinary asset was deleted out-of-band (directly in the Cloudinary dashboard,
 *    bypassing `cloudinary-delete`), which this app's own code path never does.
 *
 * Report-only by default — this script never deletes or modifies anything unless
 * `--delete-orphans` is passed, and even then only touches Cloudinary assets that
 * have zero matching `attachments` row (never touches the `attachments` table, and
 * never deletes anything with a matching row regardless of flags).
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... CLOUDINARY_CLOUD_NAME=... \
 *   CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... \
 *   node reconcile-cloudinary-orphans.mjs [--delete-orphans]
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const DELETE_ORPHANS = process.argv.includes('--delete-orphans');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error(
    'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listCloudinaryAssets() {
  const assets = [];
  let nextCursor;
  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image`);
    url.searchParams.set('prefix', 'sail-plant-maintenance/');
    url.searchParams.set('type', 'upload');
    url.searchParams.set('max_results', '500');
    if (nextCursor) url.searchParams.set('next_cursor', nextCursor);

    const response = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64')}` },
    });
    if (!response.ok) {
      throw new Error(`Cloudinary resources listing failed with status ${response.status}.`);
    }
    const data = await response.json();
    assets.push(...data.resources.map((r) => r.public_id));
    nextCursor = data.next_cursor;
  } while (nextCursor);
  return assets;
}

async function destroyAsset(publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const crypto = await import('node:crypto');
  const signature = crypto
    .createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest('hex');
  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`, {
    method: 'POST',
    body: form,
  });
  const result = await response.json();
  return result.result === 'ok' || result.result === 'not found';
}

async function main() {
  console.log('Listing Cloudinary assets under sail-plant-maintenance/ ...');
  const cloudinaryPublicIds = await listCloudinaryAssets();
  console.log(`Found ${cloudinaryPublicIds.length} Cloudinary asset(s).`);

  console.log('Listing attachments rows with a cloudinary_public_id ...');
  const { data: rows, error } = await admin
    .from('attachments')
    .select('id, entity_type, entity_id, cloudinary_public_id')
    .not('cloudinary_public_id', 'is', null);
  if (error) throw error;
  console.log(`Found ${rows.length} attachments row(s) referencing a Cloudinary asset.`);

  const dbPublicIds = new Set(rows.map((r) => r.cloudinary_public_id));
  const cloudinarySet = new Set(cloudinaryPublicIds);

  const orphanedAssets = cloudinaryPublicIds.filter((id) => !dbPublicIds.has(id));
  const danglingRows = rows.filter((r) => !cloudinarySet.has(r.cloudinary_public_id));

  console.log(`\nOrphaned Cloudinary assets (no matching attachments row): ${orphanedAssets.length}`);
  for (const id of orphanedAssets) console.log(`  - ${id}`);

  console.log(`\nDangling attachments rows (no matching Cloudinary asset): ${danglingRows.length}`);
  for (const row of danglingRows) {
    console.log(`  - attachment ${row.id} (${row.entity_type}/${row.entity_id}) -> ${row.cloudinary_public_id}`);
  }

  if (orphanedAssets.length === 0 && danglingRows.length === 0) {
    console.log('\nNo drift found — Cloudinary and attachments agree completely.');
  }

  if (DELETE_ORPHANS && orphanedAssets.length > 0) {
    console.log(`\n--delete-orphans passed: destroying ${orphanedAssets.length} orphaned Cloudinary asset(s)...`);
    for (const id of orphanedAssets) {
      const ok = await destroyAsset(id);
      console.log(`  ${ok ? 'deleted' : 'FAILED to delete'}: ${id}`);
    }
  } else if (orphanedAssets.length > 0) {
    console.log('\nRun again with --delete-orphans to remove the orphaned Cloudinary assets listed above.');
  }
}

main().catch((error) => {
  console.error('Reconciliation failed:', error.message ?? error);
  process.exit(1);
});
