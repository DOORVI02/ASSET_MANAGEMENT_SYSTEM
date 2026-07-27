import { describe, expect, it } from 'vitest';
import {
  emptyRepairRecordFormValues,
  validateRepairRecordForm,
  repairCompletionSchema,
} from './repair-form';

describe('repair form validation', () => {
  it('requires machine, reporter, date, and a useful problem description', () => {
    const errors = validateRepairRecordForm(emptyRepairRecordFormValues());
    expect(errors).toMatchObject({
      machineId: expect.any(String),
      reportedBy: expect.any(String),
      description: expect.any(String),
    });
  });

  it('rejects negative downtime and accepts a complete report', () => {
    expect(
      validateRepairRecordForm({
        ...emptyRepairRecordFormValues('m1'),
        reportedBy: 'Operator',
        description: 'Abnormal vibration from the drive end.',
        downtimeHours: -1,
      }),
    ).toHaveProperty('downtimeHours');
    expect(
      validateRepairRecordForm({
        ...emptyRepairRecordFormValues('m1'),
        reportedBy: 'Operator',
        description: 'Abnormal vibration from the drive end.',
        downtimeHours: 2.5,
      }),
    ).toEqual({});
  });

  it('requires diagnosis and resolution to complete a repair', () => {
    expect(repairCompletionSchema.safeParse({ diagnosis: '', resolution: '' }).success).toBe(false);
    expect(
      repairCompletionSchema.safeParse({
        diagnosis: 'Gear teeth damaged',
        resolution: 'Replaced gearbox and pressure tested the line.',
        downtimeHours: 4,
      }).success,
    ).toBe(true);
  });
});
