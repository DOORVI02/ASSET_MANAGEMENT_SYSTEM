/**
 * Audit trail reads.
 *
 * The table has no `department_id` of its own — it is polymorphic over
 * machine/part/maintenance/repair. Scoping is handled entirely by its RLS policy, which
 * resolves each row's department through `entity_department_id(entity_type, entity_id)`
 * (`20260727000013_rls_policies_and_grants.sql`). So this module deliberately passes no
 * scope: adding a client-side department filter here would be a second, weaker copy of a
 * rule the database already enforces, and the two could drift.
 *
 * Read-only by design. Every row is written by the audit triggers, `authenticated` holds no
 * INSERT grant at all, and UPDATE/DELETE are rejected outright by trigger for every caller
 * including the service role. There is deliberately no write function in this file.
 */
import { getSupabaseClient } from '@/lib/supabase';
import type { AuditLog } from '@/lib/types';

export type AuditEntityType = 'machine' | 'part' | 'maintenance' | 'repair';

interface AuditLogRow {
  id: string;
  entity_id: string;
  entity_type: string;
  action: string;
  performed_by: string;
  performed_at: string;
  changes: string;
}

function mapAuditLogRow(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    action: row.action,
    performedBy: row.performed_by,
    performedAt: row.performed_at,
    changes: row.changes,
  };
}

/**
 * History for one record, newest first.
 *
 * `limit` exists because this table is append-only and never pruned — there is no retention
 * policy yet (`supabase/RUNBOOK.md`, "Audit retention"), so a long-lived machine's history
 * grows without bound and an unbounded read would eventually become the slowest thing on
 * the detail screen.
 */
export async function listAuditLogsForEntity(
  entityType: AuditEntityType,
  entityId: string,
  limit = 50,
): Promise<AuditLog[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('audit_logs')
    .select('id, entity_id, entity_type, action, performed_by, performed_at, changes')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    // Ties broken by id: `performed_at` defaults to `now()`, which is the *transaction*
    // timestamp, so several rows written by one mutation share it exactly and would
    // otherwise come back in arbitrary order.
    .order('performed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapAuditLogRow);
}
