/**
 * As with `maintenance.ts`, `machines.status` is derived server-side by
 * `recompute_machine_status()` — writes here never set it directly.
 */
import { getSupabaseClient } from '@/lib/supabase';
import { mapAttachmentRow, mapRepairRecordRow } from './mappers';
import {
  clampPageSize,
  toRange,
  withTieBreaker,
  type OrderSpec,
  type PagedResult,
} from './pagination';
import type { Database } from '@/lib/database.types';
import type {
  AccessScope,
  Attachment,
  AttachmentInput,
  MutationResult,
  RepairRecord,
  RepairRecordInput,
  RepairStatus,
  RepairSummary,
} from '@/lib/types';

/**
 * `!inner`, not the default left-join embed — a `.in('machine.department_id', ...)`
 * filter on a left-joined embed silently parses but never narrows results in
 * PostgREST; `!inner` is what turns it into a real join condition. Confirmed live via
 * `supabase/scripts/verify-embed-scoping.mjs`. Safe here since `machine_id` is never
 * null.
 */
const REPAIR_SELECT = '*, machine:machines!inner(id, code, name, department_id, is_archived)';

export interface RepairListFilters {
  status?: RepairStatus;
  machineId?: string;
}

export interface RepairListParams {
  scope: AccessScope;
  departmentId?: string;
  filters?: RepairListFilters;
  order?: OrderSpec;
  page?: number;
  pageSize?: number;
}

export async function listRepairsInScope(
  params: RepairListParams,
): Promise<PagedResult<RepairRecord>> {
  if (params.scope.departmentIds.length === 0) return { rows: [], total: 0 };

  const client = getSupabaseClient();
  const pageSize = clampPageSize(params.pageSize);
  const { from, to } = toRange(params.page ?? 1, pageSize);
  const order = withTieBreaker(params.order ?? { column: 'reported_date', ascending: false });

  let query = client
    .from('repair_records')
    .select(REPAIR_SELECT, { count: 'exact' })
    .in(
      'machine.department_id',
      params.departmentId ? [params.departmentId] : params.scope.departmentIds,
    );
  if (params.filters?.status) query = query.eq('status', params.filters.status);
  if (params.filters?.machineId) query = query.eq('machine_id', params.filters.machineId);
  for (const spec of order) query = query.order(spec.column, { ascending: spec.ascending ?? true });
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []).map((row) => mapRepairRecordRow(row)), total: count ?? 0 };
}

export async function getRepairRecordInScope(
  repairId: string,
  scope: AccessScope,
): Promise<RepairRecord | undefined> {
  if (scope.departmentIds.length === 0) return undefined;
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('repair_records')
    .select(REPAIR_SELECT)
    .eq('id', repairId)
    .in('machine.department_id', scope.departmentIds)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepairRecordRow(data) : undefined;
}

/** Re-reads by id with no department filter — see the rationale in `parts.ts`. */
async function getRepairRecordById(repairId: string): Promise<RepairRecord | undefined> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('repair_records')
    .select(REPAIR_SELECT)
    .eq('id', repairId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepairRecordRow(data) : undefined;
}

export async function getRepairSummary(
  departmentId: string,
  scope: AccessScope,
): Promise<RepairSummary> {
  const empty: RepairSummary = {
    reported: 0,
    inProgress: 0,
    waitingForParts: 0,
    completed: 0,
    cancelled: 0,
    downtimeHours: 0,
  };
  if (!scope.departmentIds.includes(departmentId)) return empty;

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('repair_summary')
    .select('*')
    .eq('department_id', departmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return empty;

  // See departments.ts's getDepartmentSummary for why the `?? 0`s: the real generated
  // types show these as nullable purely from view-introspection limits, never
  // actually null in practice (the view's own SQL always COALESCEs to 0).
  return {
    reported: data.reported ?? 0,
    inProgress: data.in_progress ?? 0,
    waitingForParts: data.waiting_for_parts ?? 0,
    completed: data.completed ?? 0,
    cancelled: data.cancelled ?? 0,
    downtimeHours: Number(data.downtime_hours ?? 0),
  };
}

export async function listRepairAttachments(repairId: string): Promise<Attachment[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('attachments')
    .select('*')
    .eq('entity_type', 'repair')
    .eq('entity_id', repairId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAttachmentRow);
}

function toRepairInsert(input: RepairRecordInput) {
  return {
    machine_id: input.machineId,
    reported_date: input.reportedDate,
    reported_by: input.reportedBy.trim(),
    assigned_to: input.assignedTo?.trim() || null,
    description: input.description.trim(),
    diagnosis: input.diagnosis?.trim() || null,
    resolution: input.resolution?.trim() || null,
    parts_used: input.partsUsed?.trim() || null,
    downtime_hours: input.downtimeHours ?? null,
    remarks: input.remarks?.trim() || null,
  };
}

export async function createRepairRecord(
  input: RepairRecordInput,
): Promise<MutationResult<RepairRecord>> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('repair_records')
    .insert(toRepairInsert(input))
    .select('id')
    .single();

  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        reason: 'unknown_machine',
        message: 'Select the machine this repair applies to.',
      };
    }
    throw error;
  }

  const created = await getRepairRecordById(data.id);
  if (!created) throw new Error('Repair record was created but could not be re-read.');
  return { ok: true, data: created };
}

export async function updateRepairRecord(
  repairId: string,
  input: RepairRecordInput,
): Promise<MutationResult<RepairRecord>> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('repair_records')
    .update(toRepairInsert(input))
    .eq('id', repairId)
    .not('status', 'in', '(completed,cancelled)');

  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        reason: 'unknown_machine',
        message: 'Select the machine this repair applies to.',
      };
    }
    throw error;
  }

  const updated = await getRepairRecordById(repairId);
  if (!updated)
    return { ok: false, reason: 'not_found', message: 'This repair record no longer exists.' };
  return { ok: true, data: updated };
}

async function transitionRepairRecord(
  repairId: string,
  from: RepairStatus[],
  patch: Database['public']['Tables']['repair_records']['Update'],
): Promise<MutationResult<RepairRecord>> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('repair_records')
    .update(patch)
    .eq('id', repairId)
    .in('status', from)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      ok: false,
      reason: 'invalid_state',
      message: 'This repair record cannot make that transition.',
    };
  }

  const updated = await getRepairRecordById(repairId);
  if (!updated)
    return { ok: false, reason: 'not_found', message: 'This repair record no longer exists.' };
  return { ok: true, data: updated };
}

export function startRepairRecord(repairId: string) {
  return transitionRepairRecord(repairId, ['reported', 'waiting_for_parts'], {
    status: 'in_progress',
    start_date: new Date().toISOString(),
  });
}

export function waitForRepairParts(repairId: string) {
  return transitionRepairRecord(repairId, ['in_progress'], { status: 'waiting_for_parts' });
}

export function completeRepairRecord(
  repairId: string,
  details: { diagnosis: string; resolution: string; downtimeHours?: number },
) {
  if (!details.diagnosis.trim() || !details.resolution.trim()) {
    return Promise.resolve<MutationResult<RepairRecord>>({
      ok: false,
      reason: 'invalid_state',
      message: 'Diagnosis and resolution are required to complete a repair.',
    });
  }
  return transitionRepairRecord(repairId, ['in_progress'], {
    status: 'completed',
    completed_date: new Date().toISOString(),
    diagnosis: details.diagnosis.trim(),
    resolution: details.resolution.trim(),
    downtime_hours: details.downtimeHours ?? null,
  });
}

export function cancelRepairRecord(repairId: string, reason?: string) {
  return transitionRepairRecord(repairId, ['reported', 'in_progress', 'waiting_for_parts'], {
    status: 'cancelled',
    ...(reason?.trim() ? { remarks: reason.trim() } : {}),
  });
}

export async function addRepairAttachment(
  repairId: string,
  input: AttachmentInput,
  uploadedBy: string,
): Promise<MutationResult<Attachment>> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('attachments')
    .insert({
      entity_id: repairId,
      entity_type: 'repair',
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      uploaded_by: uploadedBy,
      url: input.url,
    })
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, data: mapAttachmentRow(data) };
}

export async function removeRepairAttachment(
  attachmentId: string,
): Promise<MutationResult<Attachment>> {
  const client = getSupabaseClient();
  const { data: existing, error: findError } = await client
    .from('attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('entity_type', 'repair')
    .maybeSingle();
  if (findError) throw findError;
  if (!existing)
    return { ok: false, reason: 'not_found', message: 'This evidence image no longer exists.' };

  const { error } = await client.from('attachments').delete().eq('id', attachmentId);
  if (error) throw error;
  return { ok: true, data: mapAttachmentRow(existing) };
}
