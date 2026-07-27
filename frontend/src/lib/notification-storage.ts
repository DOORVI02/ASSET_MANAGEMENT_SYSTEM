/**
 * Read-state persistence for the notification centre.
 *
 * Notifications are *derived*, not stored: `deriveNotifications` recomputes them from
 * the current machines, maintenance, and repairs on every render. What must persist is
 * the much smaller fact of which ones the user has already seen.
 *
 * Read state is keyed **by department**. An Officer works across several departments,
 * and pruning a flat list against only the currently selected department's live
 * notifications wiped the read state of every other department the moment anything was
 * marked read. Keying by department also keeps each department's pruning independent.
 *
 * Notification ids embed the tone (`maintenance-mr1:overdue`), so a record escalating
 * from due-soon to overdue produces a **new** id and legitimately re-alerts rather than
 * staying silently marked read.
 *
 * This is browser-local and per-device. Cross-device read state needs a server and
 * belongs with the backend phase.
 */

export const NOTIFICATION_READ_STORAGE_KEY = 'sail_notifications_read';

/** Department id → notification ids the user has seen in that department. */
export type SeenByDepartment = Record<string, string[]>;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function readSeenMap(): SeenByDepartment {
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const result: SeenByDepartment = {};
    for (const [departmentId, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (isStringArray(ids)) result[departmentId] = ids;
    }
    return result;
  } catch {
    // Corrupted or unavailable storage must not break the header.
    return {};
  }
}

export function readSeenIds(departmentId: string): string[] {
  return readSeenMap()[departmentId] ?? [];
}

/**
 * Persists the seen set for one department, pruned to ids that still exist there.
 *
 * Without pruning the list would grow for the lifetime of the browser profile, since a
 * completed maintenance record's notification disappears but its id would linger. Other
 * departments' entries are carried through untouched.
 */
export function writeSeenIds(
  departmentId: string,
  seen: Iterable<string>,
  liveIds: Iterable<string>,
): string[] {
  const live = new Set(liveIds);
  const pruned = [...new Set(seen)].filter((id) => live.has(id));

  try {
    const map = readSeenMap();
    if (pruned.length > 0) {
      map[departmentId] = pruned;
    } else {
      delete map[departmentId];
    }
    window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Persistence is best-effort; read state still applies for this session.
  }

  return pruned;
}
