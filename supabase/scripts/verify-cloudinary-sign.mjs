#!/usr/bin/env node
/**
 * Live end-to-end check for the `cloudinary-sign` Edge Function: creates a throwaway
 * Officer scoped to one seed department and a real machine, calls the deployed
 * function for a real JWT, and then actually uploads a tiny real image to Cloudinary
 * with the returned signed params — proving the signature Cloudinary computes
 * server-side from what it received matches what this function produced, not just
 * that the function returns *something*. Also checks that a caller outside the
 * entity's department is rejected, and that an invalid file type is rejected before
 * any signature is even computed.
 *
 * Usage:
 *   cd supabase/scripts && npm install   # once
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node verify-cloudinary-sign.mjs
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

// A 1x1 red pixel PNG, small enough to keep this script self-contained.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function main() {
  const email = `phase12-sign-verify-${Date.now()}@example.test`;
  const password = `Aa1!${Math.random().toString(36).slice(2)}`;

  const { data: cob, error: cobError } = await admin
    .from('departments')
    .select('id')
    .eq('code', 'COB')
    .single();
  if (cobError) throw cobError;
  const { data: cc, error: ccError } = await admin
    .from('departments')
    .select('id')
    .eq('code', 'CC')
    .single();
  if (ccError) throw ccError;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  const userId = created.user.id;

  let machineId;
  try {
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      name: 'Phase 12 Sign Verify',
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
        code: `SIGNVERIFY-${Date.now()}`,
        name: 'Sign Verify Machine',
        department_id: cob.id,
        type: 'conveyor',
        manufacturer: 'Test',
        model: 'T1',
        location: 'Test bay',
        installation_date: '2026-01-01',
        next_maintenance_date: '2026-12-01',
        description: 'cloudinary-sign check',
      })
      .select('id')
      .single();
    if (machineError) throw machineError;
    machineId = machine.id;

    // A second machine in an out-of-scope department, to check the rejection path.
    const { data: outOfScopeMachine, error: outOfScopeError } = await admin
      .from('machines')
      .insert({
        code: `SIGNVERIFY-OOS-${Date.now()}`,
        name: 'Out of scope machine',
        department_id: cc.id,
        type: 'pump',
        manufacturer: 'Test',
        model: 'T1',
        location: 'Test bay',
        installation_date: '2026-01-01',
        next_maintenance_date: '2026-12-01',
        description: 'cloudinary-sign out-of-scope check',
      })
      .select('id')
      .single();
    if (outOfScopeError) throw outOfScopeError;

    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    const accessToken = signIn.session.access_token;

    const callSign = (body) =>
      fetch(`${SUPABASE_URL}/functions/v1/cloudinary-sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

    // 1. Reject a disallowed file type before ever computing a signature.
    const badTypeResponse = await callSign({
      entityType: 'machine',
      entityId: machineId,
      fileName: 'photo.webp',
      fileType: 'image/webp',
      fileSize: 1000,
    });
    check(
      'a disallowed file type (image/webp) is rejected with 400',
      badTypeResponse.status === 400,
      `got ${badTypeResponse.status}`,
    );

    // 2. Reject an entity outside the caller's department scope.
    const outOfScopeResponse = await callSign({
      entityType: 'machine',
      entityId: outOfScopeMachine.id,
      fileName: 'photo.png',
      fileType: 'image/png',
      fileSize: 1000,
    });
    check(
      'a machine outside the caller\'s department is rejected with 403',
      outOfScopeResponse.status === 403,
      `got ${outOfScopeResponse.status}`,
    );

    // 3. The real path: sign a valid upload, then actually upload to Cloudinary.
    const signResponse = await callSign({
      entityType: 'machine',
      entityId: machineId,
      fileName: 'photo.png',
      fileType: 'image/png',
      fileSize: 100,
    });
    check('signing a valid upload for an in-scope machine succeeds', signResponse.status === 200, `got ${signResponse.status}`);
    const signed = await signResponse.json();

    const fileBytes = Buffer.from(TINY_PNG_BASE64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([fileBytes], { type: 'image/png' }), 'photo.png');
    form.append('api_key', signed.apiKey);
    form.append('timestamp', String(signed.timestamp));
    form.append('signature', signed.signature);
    form.append('folder', signed.folder);
    form.append('public_id', signed.publicId);
    form.append('overwrite', 'true');

    const uploadResponse = await fetch(signed.uploadUrl, { method: 'POST', body: form });
    const uploadResult = await uploadResponse.json();
    check(
      'Cloudinary accepts the signature this function produced (real upload succeeds)',
      uploadResponse.ok && !!uploadResult.secure_url,
      uploadResponse.ok ? uploadResult.secure_url : JSON.stringify(uploadResult),
    );

    if (uploadResponse.ok) {
      // Clean up the real Cloudinary asset via the Admin API (destroy is also a
      // signed call — reuses the same signing helper's algorithm, done inline here
      // since it's just cleanup, not part of what's being verified).
      const destroyTimestamp = Math.floor(Date.now() / 1000);
      const crypto = await import('node:crypto');
      const cloudName = signed.cloudName;
      const apiSecret = process.env.CLOUDINARY_API_SECRET_FOR_CLEANUP;
      if (apiSecret) {
        const toSign = `public_id=${uploadResult.public_id}&timestamp=${destroyTimestamp}${apiSecret}`;
        const destroySignature = crypto.createHash('sha1').update(toSign).digest('hex');
        const destroyForm = new FormData();
        destroyForm.append('public_id', uploadResult.public_id);
        destroyForm.append('api_key', signed.apiKey);
        destroyForm.append('timestamp', String(destroyTimestamp));
        destroyForm.append('signature', destroySignature);
        await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
          method: 'POST',
          body: destroyForm,
        });
      } else {
        console.log(
          `Note: set CLOUDINARY_API_SECRET_FOR_CLEANUP to auto-delete the test asset (public_id: ${uploadResult.public_id}). Leaving it in Cloudinary otherwise — harmless, but not cleaned up by this script.`,
        );
      }
    }
  } finally {
    if (machineId) {
      await admin.from('audit_logs').delete().eq('entity_id', machineId);
      await admin.from('machines').delete().eq('id', machineId);
    }
    await admin
      .from('machines')
      .delete()
      .ilike('code', 'SIGNVERIFY-OOS-%');
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
