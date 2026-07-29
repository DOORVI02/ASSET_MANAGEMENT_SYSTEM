import { getSupabaseClient } from '@/lib/supabase';
import { mapAttachmentRow, mapMachinePartRow, mapPartReplacementRow } from './mappers';
import {
  clampPageSize,
  fetchAllPages,
  toRange,
  withTieBreaker,
  type OrderSpec,
  type PagedResult,
} from './pagination';
import type {
  AccessScope,
  Attachment,
  AttachmentInput,
  MachinePart,
  MachinePartInput,
  MutationResult,
  PartReplacement,
  PartReplacementInput,
  PartsSummary,
} from '@/lib/types';

/**
 * `!inner`, not the default left-join embed — a `.in('machine.department_id', ...)`
 * filter on a left-joined embed silently parses but never narrows results in
 * PostgREST; `!inner` is what turns it into a real join condition. Confirmed live via
 * `supabase/scripts/verify-embed-scoping.mjs`. Safe here since `machine_id` is never
 * null.
 */
const PART_SELECT = '*, machine:machines!inner(id, code, name, department_id, is_archived)';

export interface PartListFilters {
  search?: string;
  machineId?: string;
  category?: string;
}

export interface PartListParams {
  scope: AccessScope;
  departmentId?: string;
  filters?: PartListFilters;
  order?: OrderSpec;
  page?: number;
  pageSize?: number;
}

/**
 * `machine_parts` has no `department_id` of its own, so scoping is expressed as an
 * inner join filter on the embedded machine — PostgREST syntax for filtering on a
 * to-one embed's column is `machine.department_id`, not a plain `.eq`.
 */
export async function listPartsInScope(params: PartListParams): Promise<PagedResult<MachinePart>> {
  if (params.scope.departmentIds.length === 0) return { rows: [], total: 0 };

  const client = getSupabaseClient();
  const pageSize = clampPageSize(params.pageSize);
  const { from, to } = toRange(params.page ?? 1, pageSize);
  const order = withTieBreaker(params.order ?? { column: 'part_code', ascending: true });

  let query = client
    .from('machine_parts')
    .select(PART_SELECT, { count: 'exact' })
    .in(
      'machine.department_id',
      params.departmentId ? [params.departmentId] : params.scope.departmentIds,
    );
  if (!params.scope.includeArchived) query = query.eq('is_archived', false);
  if (params.filters?.machineId) query = query.eq('machine_id', params.filters.machineId);
  if (params.filters?.category) query = query.eq('category', params.filters.category);
  if (params.filters?.search) {
    const term = params.filters.search.trim();
    if (term) query = query.or(`part_name.ilike.%${term}%,part_code.ilike.%${term}%`);
  }
  for (const spec of order) query = query.order(spec.column, { ascending: spec.ascending ?? true });
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []).map((row) => mapMachinePartRow(row)), total: count ?? 0 };
}

/**
 * All parts in scope, optionally narrowed to one department.
 *
 * For the screens that hold a complete list in the browser — the dashboard's derived
 * "needs attention" grouping, the reports aggregations — where the filtering is over
 * computed state the server-side params don't express. See `fetchAllPages`.
 */
export async function listAllPartsInScope(
  scope: AccessScope,
  departmentId?: string,
): Promise<MachinePart[]> {
  if (scope.departmentIds.length === 0) return [];
  return fetchAllPages((page, pageSize) =>
    listPartsInScope({ scope, departmentId, page, pageSize }),
  );
}

/**
 * All parts fitted to one machine, as one array.
 *
 * The machine detail page renders the full history in a tab rather than a paged list, so it
 * needs the whole set. Scope is still applied server-side by the underlying query and by
 * RLS; the machine filter narrows within it and cannot widen it.
 *
 * See `fetchAllPages` for why this walks pages instead of asking for one large one.
 */
export async function listAllPartsForMachine(
  machineId: string,
  scope: AccessScope,
): Promise<MachinePart[]> {
  if (scope.departmentIds.length === 0) return [];
  return fetchAllPages((page, pageSize) =>
    listPartsInScope({ scope, filters: { machineId }, page, pageSize }),
  );
}

export async function getPartInScope(
  partId: string,
  scope: AccessScope,
): Promise<MachinePart | undefined> {
  if (scope.departmentIds.length === 0) return undefined;
  const client = getSupabaseClient();
  let query = client
    .from('machine_parts')
    .select(PART_SELECT)
    .eq('id', partId)
    .in('machine.department_id', scope.departmentIds);
  if (!scope.includeArchived) query = query.eq('is_archived', false);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? mapMachinePartRow(data) : undefined;
}

/**
 * Re-reads a part by id with no department filter, for use right after a write this
 * same request just performed. RLS already limits which rows the client can see —
 * `getPartInScope` additionally needs a *known* department allow-list, which a bare
 * `insert().select('id')` result doesn't carry, so re-reading through it with an
 * empty scope would wrongly resolve to "not found."
 */
async function getPartById(partId: string): Promise<MachinePart | undefined> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('machine_parts')
    .select(PART_SELECT)
    .eq('id', partId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMachinePartRow(data) : undefined;
}

export async function isPartSerialTaken(
  serialNumber: string,
  excludePartId?: string,
): Promise<boolean> {
  const normalized = serialNumber.trim();
  if (!normalized) return false;
  const client = getSupabaseClient();
  let query = client
    .from('machine_parts')
    .select('id', { count: 'exact', head: true })
    .ilike('serial_number', normalized);
  if (excludePartId) query = query.neq('id', excludePartId);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getPartsSummary(
  departmentId: string,
  scope: AccessScope,
): Promise<PartsSummary> {
  const empty: PartsSummary = {
    total: 0,
    machinesWithParts: 0,
    categories: 0,
    dueSoon: 0,
    overdue: 0,
  };
  if (!scope.departmentIds.includes(departmentId)) return empty;

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('parts_summary')
    .select('*')
    .eq('department_id', departmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return empty;

  // See departments.ts's getDepartmentSummary for why the `?? 0`s: the real generated
  // types show these as nullable purely from view-introspection limits, never
  // actually null in practice (the view's own SQL always COALESCEs to 0).
  return {
    total: data.total ?? 0,
    machinesWithParts: data.machines_with_parts ?? 0,
    categories: data.categories ?? 0,
    dueSoon: data.due_soon ?? 0,
    overdue: data.overdue ?? 0,
  };
}

export async function listPartReplacements(partId: string): Promise<PartReplacement[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('part_replacements')
    .select('*')
    .eq('part_id', partId)
    .order('replaced_on', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPartReplacementRow);
}

export async function getPartImage(partId: string): Promise<Attachment | undefined> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('attachments')
    .select('*')
    .eq('entity_type', 'part')
    .eq('entity_id', partId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAttachmentRow(data) : undefined;
}

function toPartInsert(input: MachinePartInput) {
  return {
    machine_id: input.machineId,
    part_code: input.partCode.trim(),
    part_name: input.partName.trim(),
    category: input.category.trim(),
    serial_number: input.serialNumber?.trim() || null,
    quantity: input.quantity,
    unit: input.unit.trim(),
    position_on_machine: input.positionOnMachine.trim(),
    fitted_date: input.fittedDate,
    expected_life_months: input.expectedLifeMonths ?? null,
    notes: input.notes.trim(),
  };
}

export async function createPart(input: MachinePartInput): Promise<MutationResult<MachinePart>> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('machine_parts')
    .insert(toPartInsert(input))
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        reason: 'duplicate_serial',
        message: `Serial number ${input.serialNumber} is already recorded against another part.`,
      };
    }
    if (error.code === '23503') {
      return {
        ok: false,
        reason: 'unknown_machine',
        message: 'Select the machine this component is fitted to.',
      };
    }
    throw error;
  }

  const created = await getPartById(data.id);
  if (!created) throw new Error('Part was created but could not be re-read.');
  return { ok: true, data: created };
}

export async function updatePart(
  partId: string,
  input: MachinePartInput,
): Promise<MutationResult<MachinePart>> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('machine_parts')
    .update(toPartInsert(input))
    .eq('id', partId)
    .eq('is_archived', false);

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        reason: 'duplicate_serial',
        message: `Serial number ${input.serialNumber} is already recorded against another part.`,
      };
    }
    if (error.code === '23503') {
      return {
        ok: false,
        reason: 'unknown_machine',
        message: 'Select the machine this component is fitted to.',
      };
    }
    throw error;
  }

  const updated = await getPartById(partId);
  if (!updated)
    return { ok: false, reason: 'not_found', message: 'This part is no longer in the register.' };
  return { ok: true, data: updated };
}

async function setPartArchived(partId: string, isArchived: boolean) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('machine_parts')
    .update({ is_archived: isArchived })
    .eq('id', partId)
    .eq('is_archived', !isArchived)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function archivePart(partId: string): Promise<MutationResult<MachinePart>> {
  const row = await setPartArchived(partId, true);
  if (!row)
    return { ok: false, reason: 'already_archived', message: 'This part is already archived.' };
  const part = await getPartById(partId);
  if (!part) throw new Error('Part was archived but could not be re-read.');
  return { ok: true, data: part };
}

export async function restorePart(partId: string): Promise<MutationResult<MachinePart>> {
  const row = await setPartArchived(partId, false);
  if (!row) return { ok: false, reason: 'not_archived', message: 'This part is not archived.' };
  const part = await getPartById(partId);
  if (!part) throw new Error('Part was restored but could not be re-read.');
  return { ok: true, data: part };
}

/**
 * Records the replacement row and re-fits the part in one request via `part_replacements`
 * only — updating `machine_parts.serial_number`/`fitted_date` is a second statement,
 * since Postgres has no single-round-trip "insert here, update there" primitive over
 * PostgREST. Not wrapped in a client-side transaction: if the second call fails, the
 * replacement row still accurately records what was attempted, and the part's own
 * `updated_at`/serial simply lag until retried — an acceptable gap for Phase 11's
 * data-layer-only scope (no page calls this yet).
 */
export async function replacePart(
  partId: string,
  input: PartReplacementInput,
  performedBy: string,
): Promise<MutationResult<MachinePart>> {
  const client = getSupabaseClient();
  const current = await getPartById(partId);
  if (!current)
    return { ok: false, reason: 'not_found', message: 'This part is no longer in the register.' };

  const { error: replacementError } = await client.from('part_replacements').insert({
    part_id: partId,
    replaced_on: input.replacedOn,
    reason: input.reason.trim(),
    previous_serial_number: current.serialNumber ?? null,
    new_serial_number: input.newSerialNumber?.trim() || null,
    performed_by: performedBy,
    notes: input.notes?.trim() || null,
  });
  if (replacementError) {
    if (replacementError.code === '23505') {
      return {
        ok: false,
        reason: 'duplicate_serial',
        message: `Serial number ${input.newSerialNumber} is already recorded against another part.`,
      };
    }
    throw replacementError;
  }

  const { error: updateError } = await client
    .from('machine_parts')
    .update({ serial_number: input.newSerialNumber?.trim() || null, fitted_date: input.replacedOn })
    .eq('id', partId);
  if (updateError) throw updateError;

  const updated = await getPartById(partId);
  if (!updated) throw new Error('Part was replaced but could not be re-read.');
  return { ok: true, data: updated };
}

async function replaceAttachment(
  entityType: 'part',
  entityId: string,
  input: AttachmentInput,
  uploadedBy: string,
) {
  const client = getSupabaseClient();
  const { data: existing, error: findError } = await client
    .from('attachments')
    .select('id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { error: deleteError } = await client.from('attachments').delete().eq('id', existing.id);
    if (deleteError) throw deleteError;
  }

  const { data, error } = await client
    .from('attachments')
    .insert({
      entity_id: entityId,
      entity_type: entityType,
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      uploaded_by: uploadedBy,
      url: input.url,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapAttachmentRow(data);
}

export async function setPartImage(
  partId: string,
  input: AttachmentInput,
  uploadedBy: string,
): Promise<MutationResult<Attachment>> {
  return { ok: true, data: await replaceAttachment('part', partId, input, uploadedBy) };
}

export async function removePartImage(partId: string): Promise<MutationResult<Attachment>> {
  const client = getSupabaseClient();
  const { data: existing, error: findError } = await client
    .from('attachments')
    .select('*')
    .eq('entity_type', 'part')
    .eq('entity_id', partId)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing)
    return { ok: false, reason: 'not_found', message: 'This part has no image to remove.' };

  const { error } = await client.from('attachments').delete().eq('id', existing.id);
  if (error) throw error;
  return { ok: true, data: mapAttachmentRow(existing) };
}
