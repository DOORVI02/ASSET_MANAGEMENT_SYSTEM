/**
 * Deletes one attachment: the Cloudinary asset first, then the metadata row — via the
 * service-role client, since `attachments` has no client-facing DELETE grant at all
 * (`.agents/plan.md`/the RLS migration: history is preserved by archiving elsewhere,
 * but an attachment *is* the thing being removed here, not archived, matching the
 * mock repository's `removeMachineImage`/`removePartImage`/`removeRepairAttachment`).
 *
 * Request: { attachmentId }
 * Response: { ok: true }
 *
 * Authorization is Officer/Supervisor plus department scope on the attachment's
 * parent entity — not restricted to the original uploader, matching the mock
 * repository (any in-scope Officer/Supervisor may remove, the same as they may add).
 */
import { z } from 'npm:zod@3';
import { getAuthorizedCaller, serviceRoleClient } from '../_shared/auth.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, HttpError } from '../_shared/errors.ts';
import { requestId } from '../_shared/request-id.ts';
import { parseJsonBody } from '../_shared/validation.ts';
import { destroyResource, loadCloudinaryConfig } from '../_shared/cloudinary.ts';
import { ATTACHABLE_ENTITY_TYPES, resolveEntityDepartment } from '../_shared/entities.ts';

const requestSchema = z.object({
  attachmentId: z.string().uuid(),
});

const entityTypeSchema = z.enum(ATTACHABLE_ENTITY_TYPES);

Deno.serve(async (req) => {
  const id = requestId();
  const origin = req.headers.get('origin');
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');

    const caller = await getAuthorizedCaller(req);
    if (caller.role !== 'officer' && caller.role !== 'supervisor') {
      throw new HttpError(403, 'Only Officers and Supervisors may remove images.');
    }

    const body = await parseJsonBody(req, requestSchema);

    const client = serviceRoleClient();
    const { data: attachment, error: attachmentError } = await client
      .from('attachments')
      .select('id, entity_type, entity_id, cloudinary_public_id')
      .eq('id', body.attachmentId)
      .maybeSingle();
    if (attachmentError) throw new HttpError(500, 'Failed to look up the attachment.');
    if (!attachment) throw new HttpError(404, 'Attachment not found.');

    const entityType = entityTypeSchema.parse(attachment.entity_type);
    const departmentId = await resolveEntityDepartment(client, entityType, attachment.entity_id);
    if (!caller.departmentIds.includes(departmentId)) {
      throw new HttpError(403, 'This attachment is outside your department scope.');
    }

    if (attachment.cloudinary_public_id) {
      const cloudinary = loadCloudinaryConfig();
      await destroyResource(cloudinary, attachment.cloudinary_public_id);
    }

    const { error: deleteError } = await client.from('attachments').delete().eq('id', attachment.id);
    if (deleteError) throw new HttpError(500, 'Failed to delete the attachment record.');

    return jsonResponse({ ok: true }, id, origin);
  } catch (error) {
    return errorResponse(error, id, origin);
  }
});
