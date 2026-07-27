import { describe, expect, it } from 'vitest';
import {
  mapAttachmentRow,
  mapDepartmentRow,
  mapDueState,
  mapMachinePartRow,
  mapMachineRow,
  mapMachineRowWithoutDerived,
  mapMaintenancePlanRow,
  mapMaintenanceRecordRow,
  mapPartReplacementRow,
  mapRepairRecordRow,
} from './mappers';

describe('mapDepartmentRow', () => {
  it('maps a department row and defaults machineCount to zero', () => {
    const row = {
      id: 'dept-1',
      code: 'COB',
      name: 'Coke Oven Battery',
      head: 'R. Kumar',
      is_active: true,
      sort_order: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    expect(mapDepartmentRow(row)).toEqual({
      id: 'dept-1',
      name: 'Coke Oven Battery',
      code: 'COB',
      head: 'R. Kumar',
      machineCount: 0,
    });
  });

  it('carries through an explicit machineCount', () => {
    const row = {
      id: 'dept-1',
      code: 'COB',
      name: 'Coke Oven Battery',
      head: 'R. Kumar',
      is_active: true,
      sort_order: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    expect(mapDepartmentRow(row, 12).machineCount).toBe(12);
  });
});

const machineWithDerivedRow = {
  id: 'machine-1',
  code: 'M-001',
  name: 'Main Conveyor',
  department_id: 'dept-1',
  department_name: 'Coke Oven Battery',
  department_code: 'COB',
  type: 'conveyor' as const,
  manufacturer: 'Acme',
  model: 'X100',
  location: 'Bay 1',
  status: 'active' as const,
  installation_date: '2020-01-01',
  last_maintenance_date: '2026-01-01',
  next_maintenance_date: '2026-06-01',
  description: 'Main line conveyor',
  serial_number: 'SN-1',
  capacity: '10T',
  power_rating: '5kW',
  voltage: '440V',
  weight: '2T',
  plant_area: 'Area 1',
  bay_section: 'Bay A',
  floor: '1',
  room_position: 'North',
  is_archived: false,
  due_state: 'ok' as const,
  image_url: 'https://example.com/image.avif',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('mapMachineRow', () => {
  it('maps every field from the derived view row', () => {
    const machine = mapMachineRow(machineWithDerivedRow);

    expect(machine).toEqual({
      id: 'machine-1',
      code: 'M-001',
      name: 'Main Conveyor',
      department: 'Coke Oven Battery',
      departmentId: 'dept-1',
      type: 'conveyor',
      manufacturer: 'Acme',
      model: 'X100',
      location: 'Bay 1',
      status: 'active',
      installationDate: '2020-01-01',
      lastMaintenanceDate: '2026-01-01',
      nextMaintenanceDate: '2026-06-01',
      description: 'Main line conveyor',
      imageUrl: 'https://example.com/image.avif',
      isArchived: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      serialNumber: 'SN-1',
      capacity: '10T',
      powerRating: '5kW',
      voltage: '440V',
      weight: '2T',
      plantArea: 'Area 1',
      baySection: 'Bay A',
      floor: '1',
      roomPosition: 'North',
    });
  });

  it('turns a null last_maintenance_date into an empty string, matching the mock contract', () => {
    const machine = mapMachineRow({ ...machineWithDerivedRow, last_maintenance_date: null });
    expect(machine.lastMaintenanceDate).toBe('');
  });

  it('turns nullable technical fields into undefined rather than null', () => {
    const machine = mapMachineRow({
      ...machineWithDerivedRow,
      serial_number: null,
      capacity: null,
      power_rating: null,
      voltage: null,
      weight: null,
      plant_area: null,
      bay_section: null,
      floor: null,
      room_position: null,
      image_url: null,
    });

    expect(machine.serialNumber).toBeUndefined();
    expect(machine.capacity).toBeUndefined();
    expect(machine.powerRating).toBeUndefined();
    expect(machine.voltage).toBeUndefined();
    expect(machine.weight).toBeUndefined();
    expect(machine.plantArea).toBeUndefined();
    expect(machine.baySection).toBeUndefined();
    expect(machine.floor).toBeUndefined();
    expect(machine.roomPosition).toBeUndefined();
    expect(machine.imageUrl).toBeUndefined();
  });
});

describe('mapMachineRowWithoutDerived', () => {
  it('fills in the derived fields with their no-history defaults', () => {
    const machine = mapMachineRowWithoutDerived(
      {
        id: 'machine-2',
        code: 'M-002',
        name: 'Spare Pump',
        department_id: 'dept-2',
        type: 'pump',
        manufacturer: 'Acme',
        model: 'P1',
        location: 'Bay 2',
        status: 'inactive',
        installation_date: '2021-01-01',
        next_maintenance_date: '2026-07-01',
        description: 'Spare pump',
        serial_number: null,
        capacity: null,
        power_rating: null,
        voltage: null,
        weight: null,
        plant_area: null,
        bay_section: null,
        floor: null,
        room_position: null,
        is_archived: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      'Blowers',
    );

    expect(machine.department).toBe('Blowers');
    expect(machine.lastMaintenanceDate).toBe('');
    expect(machine.imageUrl).toBeUndefined();
  });
});

describe('mapMachinePartRow', () => {
  it('pulls the machine name/code from the embedded machine reference', () => {
    const part = mapMachinePartRow({
      id: 'part-1',
      machine_id: 'machine-1',
      part_code: 'BRG-01',
      part_name: 'Drive bearing',
      category: 'Bearing',
      serial_number: 'SN-9',
      quantity: 2,
      unit: 'pcs',
      position_on_machine: 'Drive end',
      fitted_date: '2025-01-01',
      expected_life_months: 24,
      notes: 'Standard fit',
      is_archived: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      machine: { code: 'M-001', name: 'Main Conveyor' },
    });

    expect(part.machineId).toBe('machine-1');
    expect(part.machineName).toBe('Main Conveyor');
    expect(part.machineCode).toBe('M-001');
    expect(part.quantity).toBe(2);
    expect(part.expectedLifeMonths).toBe(24);
  });

  it('coerces a numeric-string quantity and turns null expected life into undefined', () => {
    const part = mapMachinePartRow({
      id: 'part-2',
      machine_id: 'machine-1',
      part_code: 'BRG-02',
      part_name: 'Idler bearing',
      category: 'Bearing',
      serial_number: null,
      quantity: '4' as unknown as number,
      unit: 'pcs',
      position_on_machine: 'Tail end',
      fitted_date: '2025-01-01',
      expected_life_months: null,
      notes: '',
      is_archived: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      machine: { code: 'M-001', name: 'Main Conveyor' },
    });

    expect(part.quantity).toBe(4);
    expect(part.expectedLifeMonths).toBeUndefined();
    expect(part.serialNumber).toBeUndefined();
  });
});

describe('mapPartReplacementRow', () => {
  it('maps fields and leaves machineId as the documented empty placeholder', () => {
    const replacement = mapPartReplacementRow({
      id: 'replacement-1',
      part_id: 'part-1',
      replaced_on: '2026-01-01',
      reason: 'Wear',
      previous_serial_number: 'SN-8',
      new_serial_number: 'SN-9',
      performed_by: 'profile-1',
      notes: 'Routine',
      created_at: '2026-01-01T00:00:00Z',
    });

    expect(replacement.machineId).toBe('');
    expect(replacement.partId).toBe('part-1');
    expect(replacement.performedBy).toBe('profile-1');
    expect(replacement.previousSerialNumber).toBe('SN-8');
    expect(replacement.newSerialNumber).toBe('SN-9');
  });

  it('turns null optional fields into undefined', () => {
    const replacement = mapPartReplacementRow({
      id: 'replacement-2',
      part_id: 'part-1',
      replaced_on: '2026-01-01',
      reason: 'Wear',
      previous_serial_number: null,
      new_serial_number: null,
      performed_by: 'profile-1',
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    });

    expect(replacement.previousSerialNumber).toBeUndefined();
    expect(replacement.newSerialNumber).toBeUndefined();
    expect(replacement.notes).toBeUndefined();
  });
});

describe('mapMaintenanceRecordRow', () => {
  it('pulls machine and technician display fields from their embeds', () => {
    const record = mapMaintenanceRecordRow({
      id: 'maintenance-1',
      machine_id: 'machine-1',
      plan_id: 'plan-1',
      type: 'preventive',
      status: 'scheduled',
      scheduled_date: '2026-08-01',
      completed_date: null,
      technician_id: 'tech-1',
      description: 'Quarterly service',
      findings: null,
      actions: null,
      parts_used: null,
      duration_hours: null,
      remarks: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      machine: { code: 'M-001', name: 'Main Conveyor' },
      technician: { name: 'S. Sharma' },
    });

    expect(record.machineName).toBe('Main Conveyor');
    expect(record.machineCode).toBe('M-001');
    expect(record.technicianName).toBe('S. Sharma');
    expect(record.planId).toBe('plan-1');
    expect(record.completedDate).toBeUndefined();
    expect(record.durationHours).toBeUndefined();
  });

  it('coerces a numeric-string duration and turns a null plan into undefined', () => {
    const record = mapMaintenanceRecordRow({
      id: 'maintenance-2',
      machine_id: 'machine-1',
      plan_id: null,
      type: 'inspection',
      status: 'completed',
      scheduled_date: '2026-08-01',
      completed_date: '2026-08-02',
      technician_id: 'tech-1',
      description: 'Inspection',
      findings: 'All good',
      actions: 'None',
      parts_used: null,
      duration_hours: '2.5' as unknown as number,
      remarks: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      machine: { code: 'M-001', name: 'Main Conveyor' },
      technician: { name: 'S. Sharma' },
    });

    expect(record.planId).toBeUndefined();
    expect(record.durationHours).toBe(2.5);
  });
});

describe('mapMaintenancePlanRow', () => {
  it('maps an active plan with an assigned technician', () => {
    const plan = mapMaintenancePlanRow({
      id: 'plan-1',
      machine_id: 'machine-1',
      type: 'preventive',
      description: 'Quarterly service',
      interval_value: 3,
      interval_unit: 'months',
      technician_id: 'tech-1',
      is_active: true,
      is_archived: false,
      last_completed_date: '2026-05-01',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      machine: { code: 'M-001', name: 'Main Conveyor' },
      technician: { name: 'S. Sharma' },
    });

    expect(plan.technicianId).toBe('tech-1');
    expect(plan.technicianName).toBe('S. Sharma');
    expect(plan.lastCompletedDate).toBe('2026-05-01');
  });

  it('handles a plan with no technician assigned', () => {
    const plan = mapMaintenancePlanRow({
      id: 'plan-2',
      machine_id: 'machine-1',
      type: 'lubrication',
      description: 'Monthly lubrication',
      interval_value: 1,
      interval_unit: 'months',
      technician_id: null,
      is_active: false,
      is_archived: true,
      last_completed_date: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      machine: { code: 'M-001', name: 'Main Conveyor' },
      technician: null,
    });

    expect(plan.technicianId).toBeUndefined();
    expect(plan.technicianName).toBeUndefined();
    expect(plan.lastCompletedDate).toBeUndefined();
    expect(plan.isArchived).toBe(true);
  });
});

describe('mapRepairRecordRow', () => {
  it('maps an in-progress repair', () => {
    const repair = mapRepairRecordRow({
      id: 'repair-1',
      machine_id: 'machine-1',
      status: 'in_progress',
      reported_date: '2026-07-01',
      start_date: '2026-07-02',
      completed_date: null,
      reported_by: 'profile-1',
      assigned_to: 'profile-2',
      description: 'Belt tear',
      diagnosis: null,
      resolution: null,
      parts_used: null,
      downtime_hours: null,
      remarks: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      machine: { code: 'M-001', name: 'Main Conveyor' },
    });

    expect(repair.status).toBe('in_progress');
    expect(repair.assignedTo).toBe('profile-2');
    expect(repair.completedDate).toBeUndefined();
    expect(repair.downtimeHours).toBeUndefined();
  });

  it('coerces a numeric-string downtime value', () => {
    const repair = mapRepairRecordRow({
      id: 'repair-2',
      machine_id: 'machine-1',
      status: 'completed',
      reported_date: '2026-07-01',
      start_date: '2026-07-02',
      completed_date: '2026-07-03',
      reported_by: 'profile-1',
      assigned_to: null,
      description: 'Belt tear',
      diagnosis: 'Worn belt',
      resolution: 'Replaced belt',
      parts_used: 'Belt x1',
      downtime_hours: '6.5' as unknown as number,
      remarks: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      machine: { code: 'M-001', name: 'Main Conveyor' },
    });

    expect(repair.downtimeHours).toBe(6.5);
    expect(repair.assignedTo).toBeUndefined();
  });
});

describe('mapAttachmentRow', () => {
  it('maps every field', () => {
    const attachment = mapAttachmentRow({
      id: 'attachment-1',
      entity_id: 'machine-1',
      entity_type: 'machine',
      file_name: 'photo.avif',
      file_type: 'image/avif',
      file_size: 102400,
      uploaded_by: 'profile-1',
      uploaded_at: '2026-01-01T00:00:00Z',
      url: 'https://example.com/photo.avif',
      cloudinary_public_id: 'machines/machine-1',
      status: 'ready',
    });

    expect(attachment).toEqual({
      id: 'attachment-1',
      entityId: 'machine-1',
      entityType: 'machine',
      fileName: 'photo.avif',
      fileType: 'image/avif',
      fileSize: 102400,
      uploadedBy: 'profile-1',
      uploadedAt: '2026-01-01T00:00:00Z',
      url: 'https://example.com/photo.avif',
    });
  });
});

describe('mapDueState', () => {
  it('passes the DB due_state value through unchanged', () => {
    expect(mapDueState('overdue')).toBe('overdue');
    expect(mapDueState('not_applicable')).toBe('not_applicable');
  });
});
