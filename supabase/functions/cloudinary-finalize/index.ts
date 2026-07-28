/**
 * Finalizes an attachment after the browser's direct-to-Cloudinary upload completes.
 * Called with just the `publicId` the browser uploaded to — every other field
 * (`url`, `file_size`, actual format) is re-fetched from Cloudinary's own Admin API,
 * never trusted from the client, so a caller cannot report an oversized or
 * disallowed-format asset as compliant by lying about it in this request.
 *
 * Request: { entityType, entityId, publicId, fileName }
 * Response: the finalized attachment row (snake_case, as stored)
 *
 * For single-image entities (machine/part — `_shared/entities.ts`), this *updates* any
 * existing attachment row for the entity in place (via the service-role client, which
 * bypasses the missing client-facing UPDATE grant) rather than delete-then-insert:
 * `attachments_single_per_machine_or_part_idx` would reject a second row existing even
 * momentarily, and the fixed `public_id` in `cloudinary-sign` already means the new
 * upload physically overwrote the same Cloudinary asset the old row pointed to, so
 * there is no separate old asset to destroy either. For multi-image entities
 * (repair, maintenance), this simply inserts a new row alongside any existing ones.
 */
import { z } from 'npm:zod@3';
import { getAuthorizedCaller, serviceRoleClient } from '../_shared/auth.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, HttpError } from '../_shared/errors.ts';
import { requestId } from '../_shared/request-id.ts';
import { parseJsonBody } from '../_shared/validation.ts';
import { MAX_IMAGE_BYTES, formatToMimeType, loadCloudinaryConfig, lookupResource } from '../_shared/cloudinary.ts';
import { ATTACHABLE_ENTITY_TYPES, SINGLE_IMAGE_ENTITY_TYPES, resolveEntityDepartment } from '../_shared/entities.ts';

const requestSchema = z.object({
  entityType: z.enum(ATTACHABLE_ENTITY_TYPES),
  entityId: z.string().uuid(),
  publicId: z.string().min(1),
  fileName: z.string().min(1).max(255),
});

Deno.serve(async (req) => {
  const id = requestId();
  const origin = req.headers.get('origin');
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');

    const caller = await getAuthorizedCaller(req);
    if (caller.role !== 'officer' && caller.role !== 'supervisor') {
      throw new HttpError(403, 'Only Officers and Supervisors may upload images.');
    }

    const body = await parseJsonBody(req, requestSchema);

    const client = serviceRoleClient();
    const departmentId = await resolveEntityDepartment(client, body.entityType, body.entityId);
    if (!caller.departmentIds.includes(departmentId)) {
      throw new HttpError(403, 'This entity is outside your department scope.');
    }

    // A folder prefix belonging to another entity would mean the publicId this
    // finalize call names wasn't the one cloudinary-sign actually issued for this
    // entity — reject before ever asking Cloudinary about it.
    const expectedPrefix = `sail-plant-maintenance/${body.entityType}/${body.entityId}`;
    const isSingleImage = SINGLE_IMAGE_ENTITY_TYPES.has(body.entityType);
    const expectedPublicId = isSingleImage ? `sail-plant-maintenance/${body.entityType}/${body.entityId}` : null;
    if (isSingleImage ? body.publicId !== expectedPublicId : !body.publicId.startsWith(`${expectedPrefix}/`)) {
      throw new HttpError(400, 'publicId does not match this entity.');
    }

    const cloudinary = loadCloudinaryConfig();
    const resource = await lookupResource(cloudinary, body.publicId);
    if (!resource) {
      throw new HttpError(404, 'Cloudinary has no such uploaded asset. Upload it before finalizing.');
    }

    const mimeType = formatToMimeType(resource.format);
    if (!mimeType) {
      throw new HttpError(422, `Uploaded asset has a disallowed format: ${resource.format}.`);
    }
    if (resource.bytes > MAX_IMAGE_BYTES) {
      throw new HttpError(422, `Uploaded asset exceeds the ${MAX_IMAGE_BYTES / (1024 * 1024)} MB limit.`);
    }

    const attachmentRow = {
      entity_id: body.entityId,
      entity_type: body.entityType,
      file_name: body.fileName,
      file_type: mimeType,
      file_size: resource.bytes,
      uploaded_by: caller.userId,
      url: resource.secureUrl,
      cloudinary_public_id: resource.publicId,
      status: 'ready' as const,
    };

    if (isSingleImage) {
      const { data: existing, error: existingError } = await client
        .from('attachments')
        .select('id')
        .eq('entity_type', body.entityType)
        .eq('entity_id', body.entityId)
        .maybeSingle();
      if (existingError) throw new HttpError(500, 'Failed to check for an existing attachment.');

      if (existing) {
        const { data, error } = await client
          .from('attachments')
          .update(attachmentRow)
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) throw new HttpError(500, 'Failed to update the attachment.');
        return jsonResponse(data, id, origin);
      }
    }

    const { data, error } = await client.from('attachments').insert(attachmentRow).select('*').single();
    if (error) throw new HttpError(500, 'Failed to record the attachment.');
    return jsonResponse(data, id, origin);
  } catch (error) {
    return errorResponse(error, id, origin);
  }
});
