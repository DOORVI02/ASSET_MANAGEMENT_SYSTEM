import { describe, expect, it } from 'vitest';
import {
  emptyMachineFormValues,
  formValuesToMachineInput,
  hasFormChanges,
  machineFormStatusOptions,
  machineToFormValues,
  toDateInputValue,
  validateMachineForm,
  type MachineFormValues,
} from './machine-form';
import type { Machine } from './types';

/**
 * Local fixtures. These used to come from `mock-data.ts`, which was deleted in the
 * 2026-07-29 backend cutover — this file tests pure form mapping and validation, so it needs
 * a couple of representative machines, not a data layer.
 */
const mockMachines: Machine[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'SP3-PMP-001',
    name: 'Process water pump',
    department: 'Sinter Plant 3',
    departmentId: '22222222-2222-4222-8222-222222222222',
    type: 'pump',
    manufacturer: 'KSB',
    model: 'ETA 125',
    location: 'Pump house bay 2',
    status: 'active',
    installationDate: '2021-04-12',
    nextMaintenanceDate: '2026-09-01',
    description: 'Feeds the cooling circuit.',
    isArchived: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'SP3-CNV-014',
    name: 'Retired sinter conveyor',
    department: 'Sinter Plant 3',
    departmentId: '22222222-2222-4222-8222-222222222222',
    type: 'conveyor',
    manufacturer: 'Elecon',
    model: 'BC-1400',
    location: 'Sinter machine discharge',
    status: 'retired',
    installationDate: '2009-02-01',
    nextMaintenanceDate: '2026-01-01',
    description: 'Replaced during the 2026 overhaul.',
    isArchived: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
];

function validValues(overrides: Partial<MachineFormValues> = {}): MachineFormValues {
  return {
    ...emptyMachineFormValues(),
    code: 'TST-01',
    name: 'Test Machine',
    departmentId: 'd1',
    type: 'pump',
    manufacturer: 'Acme Industrial',
    model: 'T-100',
    installationDate: '2020-05-01',
    nextMaintenanceDate: '2026-11-01',
    location: 'Bay 4',
    ...overrides,
  };
}

describe('machine form validation', () => {
  it('accepts a fully populated valid record', () => {
    expect(validateMachineForm(validValues())).toEqual({});
  });

  it('requires the identity fields', () => {
    const errors = validateMachineForm(
      validValues({ code: '', name: '', manufacturer: '', model: '', location: '' }),
    );

    expect(errors.code).toBeDefined();
    expect(errors.name).toBeDefined();
    expect(errors.manufacturer).toBeDefined();
    expect(errors.model).toBeDefined();
    expect(errors.location).toBeDefined();
  });

  it('requires a department selection', () => {
    expect(validateMachineForm(validValues({ departmentId: '' })).departmentId).toBeDefined();
  });

  it('rejects machine codes containing unsupported characters', () => {
    expect(validateMachineForm(validValues({ code: 'BAD CODE!' })).code).toBeDefined();
    expect(validateMachineForm(validValues({ code: 'HP-04/A' })).code).toBeUndefined();
  });

  it('rejects a name shorter than the minimum length', () => {
    expect(validateMachineForm(validValues({ name: 'ab' })).name).toBeDefined();
  });

  it('rejects an installation date in the future', () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    const errors = validateMachineForm(
      validValues({ installationDate: toDateInputValue(nextYear.toISOString()) }),
    );

    expect(errors.installationDate).toContain('future');
  });

  it('rejects maintenance scheduled before installation', () => {
    const errors = validateMachineForm(
      validValues({ installationDate: '2020-05-01', nextMaintenanceDate: '2019-01-01' }),
    );

    expect(errors.nextMaintenanceDate).toContain('before installation');
  });

  it('requires both dates', () => {
    const errors = validateMachineForm(
      validValues({ installationDate: '', nextMaintenanceDate: '' }),
    );

    expect(errors.installationDate).toBeDefined();
    expect(errors.nextMaintenanceDate).toBeDefined();
  });

  it('enforces maximum lengths on optional fields', () => {
    expect(validateMachineForm(validValues({ capacity: 'x'.repeat(41) })).capacity).toBeDefined();
    expect(
      validateMachineForm(validValues({ description: 'x'.repeat(1001) })).description,
    ).toBeDefined();
  });

  it('does not offer retired as a form status', () => {
    expect(machineFormStatusOptions).not.toContain('retired');
  });
});

describe('machine form mapping', () => {
  it('round-trips an existing machine through the form values', () => {
    const machine = mockMachines[0];
    const values = machineToFormValues(machine);

    expect(values.code).toBe(machine.code);
    expect(values.departmentId).toBe(machine.departmentId);
    expect(validateMachineForm(values)).toEqual({});
  });

  it('maps a retired machine to inactive because retirement is archive-driven', () => {
    const retired = mockMachines.find((machine) => machine.status === 'retired');
    expect(retired).toBeDefined();
    if (!retired) return;

    expect(machineToFormValues(retired).status).toBe('inactive');
  });

  it('represents absent optional fields as empty strings for controlled inputs', () => {
    const values = machineToFormValues(mockMachines[0]);

    expect(values.serialNumber).toBe('');
    expect(values.plantArea).toBe('');
  });

  it('normalizes both plain dates and full ISO timestamps', () => {
    expect(toDateInputValue('2020-05-01')).toBe('2020-05-01');
    expect(toDateInputValue('2020-05-01T09:30:00.000Z')).toBe('2020-05-01');
    expect(toDateInputValue('')).toBe('');
    expect(toDateInputValue('not a date')).toBe('');
  });

  it('produces a repository input carrying every entered field', () => {
    const input = formValuesToMachineInput(
      validValues({ serialNumber: 'SN-9', plantArea: 'Sinter Plant' }),
    );

    expect(input).toMatchObject({
      code: 'TST-01',
      departmentId: 'd1',
      serialNumber: 'SN-9',
      plantArea: 'Sinter Plant',
      status: 'active',
    });
  });
});

describe('unsaved change detection', () => {
  it('reports no changes for identical values', () => {
    const values = validValues();

    expect(hasFormChanges(values, { ...values })).toBe(false);
  });

  it('reports a change when any field differs', () => {
    const values = validValues();

    expect(hasFormChanges({ ...values, name: 'Renamed' }, values)).toBe(true);
  });
});
