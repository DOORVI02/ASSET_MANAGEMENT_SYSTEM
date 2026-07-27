export const registeredRoutes = {
  root: '/',
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  departments: '/departments',
  dashboard: '/dashboard',
  machines: '/machines',
  machineAdd: '/machines/add',
  machineEdit: '/machines/:id/edit',
  machineDetail: '/machines/:id',
  parts: '/parts',
  partAdd: '/parts/add',
  partEdit: '/parts/:id/edit',
  partDetail: '/parts/:id',
  maintenance: '/maintenance',
  maintenanceAdd: '/maintenance/add',
  maintenanceEdit: '/maintenance/:id/edit',
  maintenanceDetail: '/maintenance/:id',
  maintenancePlanAdd: '/maintenance/plans/add',
  maintenancePlanEdit: '/maintenance/plans/:id/edit',
  repairs: '/repairs',
  repairAdd: '/repairs/add',
  repairEdit: '/repairs/:id/edit',
  repairDetail: '/repairs/:id',
  reports: '/reports',
  notifications: '/notifications',
  profile: '/profile',
  unauthorized: '/unauthorized',
} as const;

/**
 * Static machine routes must be matched before `/machines/:id`, otherwise Wouter
 * treats `add` as a machine ID. `routes.test.ts` locks that ordering in place.
 */
export const staticBeforeDynamic = [
  registeredRoutes.machineAdd,
  registeredRoutes.machineEdit,
  registeredRoutes.machineDetail,
] as const;

export const partStaticBeforeDynamic = [
  registeredRoutes.partAdd,
  registeredRoutes.partEdit,
  registeredRoutes.partDetail,
] as const;

export const maintenanceStaticBeforeDynamic = [
  registeredRoutes.maintenanceAdd,
  registeredRoutes.maintenanceEdit,
  registeredRoutes.maintenanceDetail,
] as const;

export const repairStaticBeforeDynamic = [
  registeredRoutes.repairAdd,
  registeredRoutes.repairEdit,
  registeredRoutes.repairDetail,
] as const;

/** Nothing is outstanding: every page in plan.md section 6 is now registered. */
export const plannedRoutes = [] as const;

export type RegisteredRoute = (typeof registeredRoutes)[keyof typeof registeredRoutes];
export type PlannedRoute = (typeof plannedRoutes)[number];

/** Machine register filtered by a dashboard KPI, so refresh and back preserve the drill-down. */
export function machineRegisterPath(params?: {
  status?: string;
  due?: 'soon' | 'overdue';
  /** Comma-separated department ids, for Officers filtering across their scope. */
  dept?: string;
}): string {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.due) search.set('due', params.due);
  if (params?.dept) search.set('dept', params.dept);
  const query = search.toString();
  return query ? `/machines?${query}` : '/machines';
}

export function machineDetailPath(machineId: string): string {
  return `/machines/${machineId}`;
}

export function machineEditPath(machineId: string): string {
  return `/machines/${machineId}/edit`;
}

export function partsPath(params?: { life?: string; machine?: string; category?: string }): string {
  const search = new URLSearchParams();
  if (params?.life) search.set('life', params.life);
  if (params?.machine) search.set('machine', params.machine);
  if (params?.category) search.set('category', params.category);
  const query = search.toString();
  return query ? `/parts?${query}` : '/parts';
}

export function partDetailPath(partId: string): string {
  return `/parts/${partId}`;
}

export function partEditPath(partId: string): string {
  return `/parts/${partId}/edit`;
}

export function maintenancePath(params?: {
  status?: string;
  due?: 'soon' | 'overdue';
  machine?: string;
  type?: string;
  view?: 'records' | 'plans';
}): string {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.due) search.set('due', params.due);
  if (params?.machine) search.set('machine', params.machine);
  if (params?.type) search.set('type', params.type);
  if (params?.view) search.set('view', params.view);
  const query = search.toString();
  return query ? `/maintenance?${query}` : '/maintenance';
}

export function maintenanceDetailPath(recordId: string): string {
  return `/maintenance/${recordId}`;
}

export function maintenanceEditPath(recordId: string): string {
  return `/maintenance/${recordId}/edit`;
}

export function maintenancePlanEditPath(planId: string): string {
  return `/maintenance/plans/${planId}/edit`;
}

export function repairsPath(params?: {
  status?: string;
  machine?: string;
  assignee?: string;
  dateField?: 'reported' | 'started' | 'completed';
  from?: string;
  to?: string;
  downtime?: 'recorded';
}): string {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.machine) search.set('machine', params.machine);
  if (params?.assignee) search.set('assignee', params.assignee);
  if (params?.dateField && params.dateField !== 'reported')
    search.set('dateField', params.dateField);
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.downtime) search.set('downtime', params.downtime);
  const query = search.toString();
  return query ? `/repairs?${query}` : '/repairs';
}

/**
 * Reports centre, optionally opened straight onto one report's preview with its
 * filters applied. Filters are per-report and live in the URL like every other list.
 */
export function reportsPath(params?: {
  report?: string;
  /** Free-text search across the report's plain-text columns. */
  q?: string;
  /** Inclusive range over the report's own date column, when it has one. */
  from?: string;
  to?: string;
}): string {
  const search = new URLSearchParams();
  if (params?.report) search.set('report', params.report);
  if (params?.q) search.set('q', params.q);
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  const query = search.toString();
  return query ? `/reports?${query}` : '/reports';
}

export function repairDetailPath(repairId: string): string {
  return `/repairs/${repairId}`;
}

export function repairEditPath(repairId: string): string {
  return `/repairs/${repairId}/edit`;
}
