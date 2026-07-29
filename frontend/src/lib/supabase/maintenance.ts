/**
 * Unlike the mock repository, these writes never recompute `machines.status`
 * themselves — `recompute_machine_status()` (see
 * `20260727000002..010` migrations) is a DB trigger on this table, so any status
 * change here is derived server-side automatically. Calling code just performs the
 * maintenance-record transition and re-reads.
 */
import { getSupabaseClient } from '@/lib/supabase';
import { mapMaintenancePlanRow, mapMaintenanceRecordRow } from './mappers';
import {
  clampPageSize,
  fetchAllPages,
  toRange,
  withTieBreaker,
  type OrderSpec,
  type PagedResult,
} from './pagination';
import type { Database } from '@/lib/database.types';
import type {
  AccessScope,
  MaintenancePlan,
  MaintenancePlanInput,
  MaintenanceRecord,
  MaintenanceRecordInput,
  MaintenanceStatus,
  MaintenanceSummary,
  MutationResult,
} from '@/lib/types';

/**
 * `machine:machines!inner(...)`, not the default left-join embed — PostgREST silently
 * ignores a `.in('machine.department_id', ...)` filter on a left-joined embed (it
 * parses but never actually narrows results); `!inner` is what makes the filter a real
 * join condition. Confirmed live: `supabase/scripts/verify-embed-scoping.mjs`. Safe
 * here because `machine_id`/`plan_id`'s machine reference is never null. The
 * `technician` embed stays a left join deliberately — `maintenance_plans.technician_id`
 * is nullable, and this SELECT is shared with plans.
 */
const RECORD_SELECT =
  '*, machine:machines!inner(id, code, name, department_id, is_archived), technician:technicians(name)';
const PLAN_SELECT =
  '*, machine:machines!inner(id, code, name, department_id, is_archived), technician:technicians(name)';

export interface MaintenanceListFilters {
  status?: MaintenanceStatus;
  machineId?: string;
}

export interface MaintenanceListParams {
  scope: AccessScope;
  departmentId?: string;
  filters?: MaintenanceListFilters;
  order?: OrderSpec;
  page?: number;
  pageSize?: number;
}

export async function listMaintenanceInScope(
  params: MaintenanceListParams,
): Promise<PagedResult<MaintenanceRecord>> {
  if (params.scope.departmentIds.length === 0) return { rows: [], total: 0 };

  const client = getSupabaseClient();
  const pageSize = clampPageSize(params.pageSize);
  const { from, to } = toRange(params.page ?? 1, pageSize);
  const order = withTieBreaker(params.order ?? { column: 'scheduled_date', ascending: false });

  let query = client
    .from('maintenance_records')
    .select(RECORD_SELECT, { count: 'exact' })
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
  return { rows: (data ?? []).map((row) => mapMaintenanceRecordRow(row)), total: count ?? 0 };
}

/**
 * All one machine's maintenance history, as one array.
 *
 * The machine detail page renders the full history in a tab rather than a paged list, so it
 * needs the whole set. Scope is still applied server-side by the underlying query and by
 * RLS; the machine filter narrows within it and cannot widen it.
 *
 * See `fetchAllPages` for why this walks pages instead of asking for one large one.
 */
export async function listAllMaintenanceForMachine(
  machineId: string,
  scope: AccessScope,
): Promise<MaintenanceRecord[]> {
  if (scope.departmentIds.length === 0) return [];
  return fetchAllPages((page, pageSize) =>
    listMaintenanceInScope({ scope, filters: { machineId }, page, pageSize }),
  );
}

export async function getMaintenanceRecordInScope(
  recordId: string,
  scope: AccessScope,
): Promise<MaintenanceRecord | undefined> {
  if (scope.departmentIds.length === 0) return undefined;
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('maintenance_records')
    .select(RECORD_SELECT)
    .eq('id', recordId)
    .in('machine.department_id', scope.departmentIds)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMaintenanceRecordRow(data) : undefined;
}

/**
 * Re-reads by id with no department filter, for use right after a write this same
 * request just performed (see the identical helper and rationale in `parts.ts`).
 */
async function getMaintenanceRecordById(recordId: string): Promise<MaintenanceRecord | undefined> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('maintenance_records')
    .select(RECORD_SELECT)
    .eq('id', recordId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMaintenanceRecordRow(data) : undefined;
}

async function getMaintenancePlanById(planId: string): Promise<MaintenancePlan | undefined> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('maintenance_plans')
    .select(PLAN_SELECT)
    .eq('id', planId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMaintenancePlanRow(data) : undefined;
}

export async function getMaintenanceSummary(
  departmentId: string,
  scope: AccessScope,
): Promise<MaintenanceSummary> {
  const empty: MaintenanceSummary = {
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    dueSoon: 0,
    overdue: 0,
  };
  if (!scope.departmentIds.includes(departmentId)) return empty;

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('maintenance_summary')
    .select('*')
    .eq('department_id', departmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return empty;

  // See departments.ts's getDepartmentSummary for why the `?? 0`s: the real generated
  // types show these as nullable purely from view-introspection limits, never
  // actually null in practice (the view's own SQL always COALESCEs to 0).
  return {
    scheduled: data.scheduled ?? 0,
    inProgress: data.in_progress ?? 0,
    completed: data.completed ?? 0,
    cancelled: data.cancelled ?? 0,
    dueSoon: data.due_soon ?? 0,
    overdue: data.overdue ?? 0,
  };
}

export async function listMaintenancePlansInScope(
  params: Pick<MaintenanceListParams, 'scope' | 'departmentId'>,
): Promise<MaintenancePlan[]> {
  if (params.scope.departmentIds.length === 0) return [];
  const client = getSupabaseClient();
  let query = client
    .from('maintenance_plans')
    .select(PLAN_SELECT)
    .in(
      'machine.department_id',
      params.departmentId ? [params.departmentId] : params.scope.departmentIds,
    );
  if (!params.scope.includeArchived) query = query.eq('is_archived', false);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapMaintenancePlanRow(row));
}

export async function getMaintenancePlanInScope(
  planId: string,
  scope: AccessScope,
): Promise<MaintenancePlan | undefined> {
  if (scope.departmentIds.length === 0) return undefined;
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('maintenance_plans')
    .select(PLAN_SELECT)
    .eq('id', planId)
    .in('machine.department_id', scope.departmentIds)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMaintenancePlanRow(data) : undefined;
}

function toRecordInsert(input: MaintenanceRecordInput) {
  return {
    machine_id: input.machineId,
    plan_id: input.planId ?? null,
    type: input.type,
    scheduled_date: input.scheduledDate,
    technician_id: input.technicianId,
    description: input.description.trim(),
    findings: input.findings?.trim() || null,
    actions: input.actions?.trim() || null,
    parts_used: input.partsUsed?.trim() || null,
    duration_hours: input.durationHours ?? null,
    remarks: input.remarks?.trim() || null,
  };
}

export async function createMaintenanceRecord(
  input: MaintenanceRecordInput,
): Promise<MutationResult<MaintenanceRecord>> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('maintenance_records')
    .insert(toRecordInsert(input))
    .select('id')
    .single();

  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        reason: 'unknown_machine',
        message: 'Select the machine this maintenance applies to.',
      };
    }
    throw error;
  }

  const created = await getMaintenanceRecordById(data.id);
  if (!created) throw new Error('Maintenance record was created but could not be re-read.');
  return { ok: true, data: created };
}

export async function updateMaintenanceRecord(
  recordId: string,
  input: MaintenanceRecordInput,
): Promise<MutationResult<MaintenanceRecord>> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('maintenance_records')
    .update(toRecordInsert(input))
    .eq('id', recordId)
    .in('status', ['scheduled', 'in_progress']);

  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        reason: 'unknown_machine',
        message: 'Select the machine this maintenance applies to.',
      };
    }
    throw error;
  }

  const updated = await getMaintenanceRecordById(recordId);
  if (!updated)
    return { ok: false, reason: 'not_found', message: 'This maintenance record no longer exists.' };
  return { ok: true, data: updated };
}

async function transitionMaintenanceRecord(
  recordId: string,
  from: MaintenanceStatus[],
  patch: Database['public']['Tables']['maintenance_records']['Update'],
): Promise<MutationResult<MaintenanceRecord>> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('maintenance_records')
    .update(patch)
    .eq('id', recordId)
    .in('status', from)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      ok: false,
      reason: 'invalid_state',
      message: 'This maintenance record cannot make that transition.',
    };
  }

  const updated = await getMaintenanceRecordById(recordId);
  if (!updated)
    return { ok: false, reason: 'not_found', message: 'This maintenance record no longer exists.' };
  return { ok: true, data: updated };
}

export function startMaintenanceRecord(recordId: string) {
  return transitionMaintenanceRecord(recordId, ['scheduled'], { status: 'in_progress' });
}

export function completeMaintenanceRecord(
  recordId: string,
  details: { actions?: string; findings?: string; durationHours?: number },
) {
  return transitionMaintenanceRecord(recordId, ['scheduled', 'in_progress'], {
    status: 'completed',
    completed_date: new Date().toISOString(),
    ...(details.actions?.trim() ? { actions: details.actions.trim() } : {}),
    ...(details.findings?.trim() ? { findings: details.findings.trim() } : {}),
    ...(details.durationHours ? { duration_hours: details.durationHours } : {}),
  });
}

export function cancelMaintenanceRecord(recordId: string, reason?: string) {
  return transitionMaintenanceRecord(recordId, ['scheduled', 'in_progress'], {
    status: 'cancelled',
    ...(reason?.trim() ? { remarks: reason.trim() } : {}),
  });
}

export function reopenMaintenanceRecord(recordId: string) {
  return transitionMaintenanceRecord(recordId, ['completed'], {
    status: 'in_progress',
    completed_date: null,
  });
}

function toPlanInsert(input: MaintenancePlanInput) {
  return {
    machine_id: input.machineId,
    type: input.type,
    description: input.description.trim(),
    interval_value: input.intervalValue,
    interval_unit: input.intervalUnit,
    technician_id: input.technicianId ?? null,
    is_active: input.isActive,
  };
}

export async function createMaintenancePlan(
  input: MaintenancePlanInput,
): Promise<MutationResult<MaintenancePlan>> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('maintenance_plans')
    .insert(toPlanInsert(input))
    .select('id')
    .single();
  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        reason: 'unknown_machine',
        message: 'Select the machine this plan applies to.',
      };
    }
    throw error;
  }

  const created = await getMaintenancePlanById(data.id);
  if (!created) throw new Error('Maintenance plan was created but could not be re-read.');
  return { ok: true, data: created };
}

export async function updateMaintenancePlan(
  planId: string,
  input: MaintenancePlanInput,
): Promise<MutationResult<MaintenancePlan>> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('maintenance_plans')
    .update(toPlanInsert(input))
    .eq('id', planId)
    .eq('is_archived', false);
  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        reason: 'unknown_machine',
        message: 'Select the machine this plan applies to.',
      };
    }
    throw error;
  }

  const updated = await getMaintenancePlanById(planId);
  if (!updated)
    return { ok: false, reason: 'not_found', message: 'This maintenance plan no longer exists.' };
  return { ok: true, data: updated };
}

async function setPlanArchived(planId: string, isArchived: boolean) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('maintenance_plans')
    .update({ is_archived: isArchived })
    .eq('id', planId)
    .eq('is_archived', !isArchived)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function archiveMaintenancePlan(
  planId: string,
): Promise<MutationResult<MaintenancePlan>> {
  const row = await setPlanArchived(planId, true);
  if (!row)
    return { ok: false, reason: 'already_archived', message: 'This plan is already archived.' };
  const plan = await getMaintenancePlanById(planId);
  if (!plan) throw new Error('Plan was archived but could not be re-read.');
  return { ok: true, data: plan };
}

export async function restoreMaintenancePlan(
  planId: string,
): Promise<MutationResult<MaintenancePlan>> {
  const row = await setPlanArchived(planId, false);
  if (!row) return { ok: false, reason: 'not_archived', message: 'This plan is not archived.' };
  const plan = await getMaintenancePlanById(planId);
  if (!plan) throw new Error('Plan was restored but could not be re-read.');
  return { ok: true, data: plan };
}
