import { describe, expect, it } from 'vitest';
import {
  machineDetailPath,
  machineEditPath,
  maintenanceDetailPath,
  maintenanceEditPath,
  maintenancePath,
  maintenancePlanEditPath,
  maintenanceStaticBeforeDynamic,
  partDetailPath,
  partEditPath,
  partStaticBeforeDynamic,
  partsPath,
  plannedRoutes,
  repairDetailPath,
  repairEditPath,
  repairStaticBeforeDynamic,
  repairsPath,
  reportsPath,
  registeredRoutes,
  staticBeforeDynamic,
} from './routes';

describe('route manifest', () => {
  it('keeps registered routes unique and includes the public authentication routes', () => {
    const routes = Object.values(registeredRoutes);

    expect(new Set(routes).size).toBe(routes.length);
    expect(routes).toEqual(
      expect.arrayContaining(['/', '/login', '/forgot-password', '/dashboard', '/machines']),
    );
  });

  it('registers the machine add and edit routes', () => {
    expect(Object.values(registeredRoutes)).toEqual(
      expect.arrayContaining(['/machines/add', '/machines/:id/edit', '/machines/:id']),
    );
  });

  it('orders the static machine routes ahead of the dynamic one', () => {
    const dynamicIndex = staticBeforeDynamic.indexOf(registeredRoutes.machineDetail);

    expect(staticBeforeDynamic.indexOf(registeredRoutes.machineAdd)).toBeLessThan(dynamicIndex);
    expect(staticBeforeDynamic.indexOf(registeredRoutes.machineEdit)).toBeLessThan(dynamicIndex);
  });

  it('no longer lists the machine routes as planned', () => {
    expect(plannedRoutes).not.toContain('/machines/add');
    expect(plannedRoutes).not.toContain('/machines/:id/edit');
  });

  it('registers the installed-part routes', () => {
    expect(Object.values(registeredRoutes)).toEqual(
      expect.arrayContaining(['/parts', '/parts/add', '/parts/:id/edit', '/parts/:id']),
    );
  });

  it('orders the static part routes ahead of the dynamic one', () => {
    const dynamicIndex = partStaticBeforeDynamic.indexOf(registeredRoutes.partDetail);

    expect(partStaticBeforeDynamic.indexOf(registeredRoutes.partAdd)).toBeLessThan(dynamicIndex);
    expect(partStaticBeforeDynamic.indexOf(registeredRoutes.partEdit)).toBeLessThan(dynamicIndex);
  });

  it('no longer lists the part routes as planned', () => {
    expect(plannedRoutes).not.toContain('/parts');
  });

  it('registers the maintenance routes', () => {
    expect(Object.values(registeredRoutes)).toEqual(
      expect.arrayContaining([
        '/maintenance',
        '/maintenance/add',
        '/maintenance/:id/edit',
        '/maintenance/:id',
        '/maintenance/plans/add',
        '/maintenance/plans/:id/edit',
      ]),
    );
  });

  it('orders the static maintenance routes ahead of the dynamic one', () => {
    const dynamicIndex = maintenanceStaticBeforeDynamic.indexOf(registeredRoutes.maintenanceDetail);

    expect(maintenanceStaticBeforeDynamic.indexOf(registeredRoutes.maintenanceAdd)).toBeLessThan(
      dynamicIndex,
    );
    expect(maintenanceStaticBeforeDynamic.indexOf(registeredRoutes.maintenanceEdit)).toBeLessThan(
      dynamicIndex,
    );
  });

  it('no longer lists maintenance as planned', () => {
    expect(plannedRoutes).not.toContain('/maintenance');
    expect(plannedRoutes).not.toContain('/maintenance/add');
  });

  it('registers repair routes ahead of the repair detail route', () => {
    expect(Object.values(registeredRoutes)).toEqual(
      expect.arrayContaining(['/repairs', '/repairs/add', '/repairs/:id/edit', '/repairs/:id']),
    );
    const dynamicIndex = repairStaticBeforeDynamic.indexOf(registeredRoutes.repairDetail);
    expect(repairStaticBeforeDynamic.indexOf(registeredRoutes.repairAdd)).toBeLessThan(
      dynamicIndex,
    );
    expect(repairStaticBeforeDynamic.indexOf(registeredRoutes.repairEdit)).toBeLessThan(
      dynamicIndex,
    );
  });

  it('no longer lists repairs as planned and builds repair paths', () => {
    expect(plannedRoutes).not.toContain('/repairs');
    expect(repairsPath({ status: 'in_progress', machine: 'm6', downtime: 'recorded' })).toBe(
      '/repairs?status=in_progress&machine=m6&downtime=recorded',
    );
    expect(repairDetailPath('rr1')).toBe('/repairs/rr1');
    expect(repairEditPath('rr1')).toBe('/repairs/rr1/edit');
  });

  it('has no outstanding planned page: every route in plan.md section 6 is registered', () => {
    expect(plannedRoutes).toHaveLength(0);
    expect(Object.values(registeredRoutes)).toEqual(
      expect.arrayContaining(['/reset-password', '/reports', '/notifications']),
    );
  });

  it('registers the reports centre and no longer lists it as planned', () => {
    expect(Object.values(registeredRoutes)).toContain('/reports');
    expect(plannedRoutes).not.toContain('/reports');
    expect(reportsPath()).toBe('/reports');
    expect(reportsPath({ report: 'downtime' })).toBe('/reports?report=downtime');
  });

  it('builds maintenance paths that match the registered patterns', () => {
    expect(maintenancePath()).toBe('/maintenance');
    expect(maintenancePath({ status: 'scheduled', view: 'plans' })).toBe(
      '/maintenance?status=scheduled&view=plans',
    );
    expect(maintenanceDetailPath('mr1')).toBe('/maintenance/mr1');
    expect(maintenanceEditPath('mr1')).toBe('/maintenance/mr1/edit');
    expect(maintenancePlanEditPath('plan1')).toBe('/maintenance/plans/plan1/edit');
  });

  it('builds part paths that match the registered patterns', () => {
    expect(partsPath()).toBe('/parts');
    expect(partsPath({ machine: 'm1' })).toBe('/parts?machine=m1');
    expect(partsPath({ life: 'overdue', category: 'Bearings' })).toBe(
      '/parts?life=overdue&category=Bearings',
    );
    expect(partDetailPath('p1')).toBe('/parts/p1');
    expect(partEditPath('p1')).toBe('/parts/p1/edit');
  });

  it('builds machine paths that match the registered patterns', () => {
    expect(machineDetailPath('m1')).toBe('/machines/m1');
    expect(machineEditPath('m1')).toBe('/machines/m1/edit');
  });
});
