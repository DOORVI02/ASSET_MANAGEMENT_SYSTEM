#!/usr/bin/env node
/**
 * Live end-to-end check for the full Phase 12 Cloudinary lifecycle: sign -> upload to
 * Cloudinary -> finalize (writes the attachments row) -> replace (single-image
 * entities only) -> delete. Covers both entity shapes:
 *
 *  - machine (single-image, replace-on-upload): upload once, finalize (insert),
 *    upload again with a new file, finalize again (update in place, old Cloudinary
 *    asset already overwritten by the fixed public_id + overwrite=true), confirm
 *    exactly one attachments row exists throughout, then delete it.
 *  - repair (multi-image): upload+finalize twice, confirm TWO attachments rows exist
 *    (not a replace), then delete one and confirm the other survives.
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node verify-cloudinary-lifecycle.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`);
}

// Two distinct 1x1 PNGs (different pixel colors) so re-uploads are byte-distinguishable.
const PNG_RED =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const PNG_BLUE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC';

async function signAndUpload(client, { entityType, entityId, fileName, base64 }) {
  const signRes = await client.functions.invoke('cloudinary-sign', {
    body: { entityType, entityId, fileName, fileType: 'image/png', fileSize: 100 },
  });
  if (signRes.error) throw new Error(`cloudinary-sign failed: ${JSON.stringify(signRes.error)}`);
  const signed = signRes.data;

  const form = new FormData();
  form.append('file', new Blob([Buffer.from(base64, 'base64')], { type: 'image/png' }), fileName);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  form.append('folder', signed.folder);
  form.append('public_id', signed.publicId);
  if (signed.overwrite) form.append('overwrite', 'true');

  const uploadRes = await fetch(signed.uploadUrl, { method: 'POST', body: form });
  const uploadResult = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`Cloudinary upload failed: ${JSON.stringify(uploadResult)}`);

  const finalizeRes = await client.functions.invoke('cloudinary-finalize', {
    body: { entityType, entityId, publicId: uploadResult.public_id, fileName },
  });
  if (finalizeRes.error) throw new Error(`cloudinary-finalize failed: ${JSON.stringify(finalizeRes.error)}`);
  return finalizeRes.data;
}

async function main() {
  const email = `phase12-lifecycle-verify-${Date.now()}@example.test`;
  const password = `Aa1!${Math.random().toString(36).slice(2)}`;

  const { data: cob, error: cobError } = await admin.from('departments').select('id').eq('code', 'COB').single();
  if (cobError) throw cobError;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  const userId = created.user.id;

  let machineId;
  let repairId;
  const cloudinaryPublicIds = new Set();

  try {
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      name: 'Phase 12 Lifecycle Verify',
      email,
      phone: '+91 90000 00000',
      role: 'officer',
      position: 'Maintenance Officer',
      department_id: cob.id,
    });
    if (profileError) throw profileError;

    const { error: scopeError } = await admin
      .from('profile_department_scope')
      .insert({ profile_id: userId, department_id: cob.id });
    if (scopeError) throw scopeError;

    const { data: machine, error: machineError } = await admin
      .from('machines')
      .insert({
        code: `LIFECYCLE-${Date.now()}`,
        name: 'Lifecycle Verify Machine',
        department_id: cob.id,
        type: 'conveyor',
        manufacturer: 'Test',
        model: 'T1',
        location: 'Test bay',
        installation_date: '2026-01-01',
        next_maintenance_date: '2026-12-01',
        description: 'cloudinary lifecycle check',
      })
      .select('id')
      .single();
    if (machineError) throw machineError;
    machineId = machine.id;

    const { data: repair, error: repairError } = await admin
      .from('repair_records')
      .insert({
        machine_id: machineId,
        reported_date: '2026-01-01',
        reported_by: userId,
        description: 'cloudinary lifecycle check',
      })
      .select('id')
      .single();
    if (repairError) throw repairError;
    repairId = repair.id;

    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });

    // ── Machine: single-image, replace-on-upload ──────────────────────────────
    const firstMachineAttachment = await signAndUpload(client, {
      entityType: 'machine',
      entityId: machineId,
      fileName: 'first.png',
      base64: PNG_RED,
    });
    cloudinaryPublicIds.add(firstMachineAttachment.cloudinary_public_id);

    const { count: countAfterFirst } = await admin
      .from('attachments')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'machine')
      .eq('entity_id', machineId);
    check('after the first machine upload, exactly one attachment row exists', countAfterFirst === 1);

    const secondMachineAttachment = await signAndUpload(client, {
      entityType: 'machine',
      entityId: machineId,
      fileName: 'second.png',
      base64: PNG_BLUE,
    });
    check(
      'replacing a machine image reuses the same attachment row id',
      secondMachineAttachment.id === firstMachineAttachment.id,
    );
    check(
      'replacing a machine image reuses the same Cloudinary public_id',
      secondMachineAttachment.cloudinary_public_id === firstMachineAttachment.cloudinary_public_id,
    );

    const { count: countAfterSecond } = await admin
      .from('attachments')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'machine')
      .eq('entity_id', machineId);
    check('after replacing the machine image, still exactly one attachment row exists', countAfterSecond === 1);

    const deleteMachineRes = await client.functions.invoke('cloudinary-delete', {
      body: { attachmentId: secondMachineAttachment.id },
    });
    check('deleting the machine attachment succeeds', !deleteMachineRes.error, JSON.stringify(deleteMachineRes.error));

    const { count: countAfterDelete } = await admin
      .from('attachments')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'machine')
      .eq('entity_id', machineId);
    check('after deleting, zero machine attachment rows remain', countAfterDelete === 0);

    // ── Repair: multi-image, additive ──────────────────────────────────────────
    const firstRepairAttachment = await signAndUpload(client, {
      entityType: 'repair',
      entityId: repairId,
      fileName: 'before.png',
      base64: PNG_RED,
    });
    cloudinaryPublicIds.add(firstRepairAttachment.cloudinary_public_id);
    const secondRepairAttachment = await signAndUpload(client, {
      entityType: 'repair',
      entityId: repairId,
      fileName: 'after.png',
      base64: PNG_BLUE,
    });
    cloudinaryPublicIds.add(secondRepairAttachment.cloudinary_public_id);

    check(
      'two repair uploads get two distinct attachment rows (not a replace)',
      firstRepairAttachment.id !== secondRepairAttachment.id &&
        firstRepairAttachment.cloudinary_public_id !== secondRepairAttachment.cloudinary_public_id,
    );

    const { count: countRepairAfterTwo } = await admin
      .from('attachments')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'repair')
      .eq('entity_id', repairId);
    check('after two repair uploads, exactly two attachment rows exist', countRepairAfterTwo === 2);

    const deleteOneRepairRes = await client.functions.invoke('cloudinary-delete', {
      body: { attachmentId: firstRepairAttachment.id },
    });
    check('deleting one repair attachment succeeds', !deleteOneRepairRes.error);

    const { data: remainingRepairAttachments } = await admin
      .from('attachments')
      .select('id')
      .eq('entity_type', 'repair')
      .eq('entity_id', repairId);
    check(
      'deleting one repair attachment leaves the other intact',
      remainingRepairAttachments?.length === 1 && remainingRepairAttachments[0].id === secondRepairAttachment.id,
    );

    const deleteOtherRepairRes = await client.functions.invoke('cloudinary-delete', {
      body: { attachmentId: secondRepairAttachment.id },
    });
    check('deleting the second repair attachment succeeds', !deleteOtherRepairRes.error);
  } finally {
    // Best-effort Cloudinary cleanup for anything the test's own deletes didn't
    // already remove (e.g. if a check failed partway through).
    const apiSecret = process.env.CLOUDINARY_API_SECRET_FOR_CLEANUP;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME_FOR_CLEANUP;
    if (apiSecret && cloudName) {
      const crypto = await import('node:crypto');
      for (const publicId of cloudinaryPublicIds) {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = crypto
          .createHash('sha1')
          .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
          .digest('hex');
        const form = new FormData();
        form.append('public_id', publicId);
        form.append('api_key', process.env.CLOUDINARY_API_KEY_FOR_CLEANUP ?? '');
        form.append('timestamp', String(timestamp));
        form.append('signature', signature);
        await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: 'POST', body: form }).catch(
          () => {},
        );
      }
    }

    if (repairId) {
      await admin.from('attachments').delete().eq('entity_type', 'repair').eq('entity_id', repairId);
      await admin.from('audit_logs').delete().eq('entity_id', repairId);
      await admin.from('repair_records').delete().eq('id', repairId);
    }
    if (machineId) {
      await admin.from('attachments').delete().eq('entity_type', 'machine').eq('entity_id', machineId);
      await admin.from('audit_logs').delete().eq('entity_id', machineId);
      await admin.from('machines').delete().eq('id', machineId);
    }
    await admin.from('profile_department_scope').delete().eq('profile_id', userId);
    await admin.from('profiles').update({ is_active: false }).eq('id', userId);
    await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Verification failed:', error.message ?? error);
  process.exit(1);
});
