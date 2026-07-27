import { beforeEach, describe, expect, it } from 'vitest';
import { createMockRepository, type MockRepository } from './mock-repository';
import type { AccessScope, MachinePartInput } from './types';

/** Officer-like: Plate Mill plus Coal Handling, archived visible. */
const officer: AccessScope = { departmentIds: ['d15', 'd3'], includeArchived: true };
/** Supervisor-like: Coal Handling only, archived hidden. */
const supervisor: AccessScope = { departmentIds: ['d3'], includeArchived: false };

function partInput(overrides: Partial<MachinePartInput> = {}): MachinePartInput {
  return {
    machineId: 'm1',
    partCode: 'NEW-01',
    partName: 'New Test Component',
    category: 'Bearings',
    quantity: 2,
    unit: 'pcs',
    positionOnMachine: 'Drive end housing',
    fittedDate: '2026-01-15',
    expectedLifeMonths: 12,
    notes: 'Fitted by a unit test.',
    ...overrides,
  };
}

describe('installed part repository', () => {
  let repository: MockRepository;

  beforeEach(() => {
    repository = createMockRepository();
  });

  describe('createPart', () => {
    it('fits a part and denormalizes the machine code and name', () => {
      const result = repository.createPart(partInput(), 'u1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toMatchObject({
        partCode: 'NEW-01',
        machineId: 'm1',
        machineCode: 'HP-04',
        isArchived: false,
      });
      expect(repository.listAuditLogsForEntity(result.data.id)[0]).toMatchObject({
        action: 'part_fitted',
        entityType: 'part',
      });
    });

    it('rejects an unknown machine', () => {
      expect(repository.createPart(partInput({ machineId: 'nope' }), 'u1')).toMatchObject({
        ok: false,
        reason: 'unknown_machine',
      });
    });

    it('refuses to fit a part to an archived machine', () => {
      expect(repository.createPart(partInput({ machineId: 'm15' }), 'u1')).toMatchObject({
        ok: false,
        reason: 'already_archived',
      });
    });

    it('rejects a duplicate serial number regardless of casing', () => {
      const existing = repository.listParts().find((part) => part.serialNumber);
      expect(existing?.serialNumber).toBeDefined();

      const result = repository.createPart(
        partInput({ serialNumber: existing!.serialNumber!.toLowerCase() }),
        'u1',
      );

      expect(result).toMatchObject({ ok: false, reason: 'duplicate_serial' });
    });

    it('allows a blank serial number on more than one part', () => {
      expect(repository.createPart(partInput({ serialNumber: '' }), 'u1').ok).toBe(true);
      expect(
        repository.createPart(partInput({ partCode: 'NEW-02', serialNumber: '' }), 'u1').ok,
      ).toBe(true);
    });
  });

  describe('updatePart', () => {
    it('applies changes and audits them', () => {
      const result = repository.updatePart('p1', partInput({ partName: 'Renamed Filter' }), 'u1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.partName).toBe('Renamed Filter');
      expect(repository.listAuditLogsForEntity('p1')[0]).toMatchObject({ action: 'part_updated' });
    });

    it('lets a part keep its own serial number', () => {
      const part = repository.listParts().find((candidate) => candidate.id === 'p1');
      const result = repository.updatePart(
        'p1',
        partInput({ serialNumber: part?.serialNumber }),
        'u1',
      );

      expect(result.ok).toBe(true);
    });

    it("rejects taking another part's serial number", () => {
      const other = repository.listParts().find((part) => part.id === 'p4');
      const result = repository.updatePart(
        'p1',
        partInput({ serialNumber: other?.serialNumber }),
        'u1',
      );

      expect(result).toMatchObject({ ok: false, reason: 'duplicate_serial' });
    });

    it('moves a part to a different machine and updates the denormalized fields', () => {
      const result = repository.updatePart('p1', partInput({ machineId: 'm6' }), 'u1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.machineCode).toBe('CD-11');
    });

    it('rejects a missing part', () => {
      expect(repository.updatePart('nope', partInput(), 'u1')).toMatchObject({
        ok: false,
        reason: 'not_found',
      });
    });
  });

  describe('remove and restore', () => {
    it('removes a part but keeps it for history', () => {
      const result = repository.archivePart('p1', 'u1');

      expect(result).toMatchObject({ ok: true });
      expect(repository.listParts().some((part) => part.id === 'p1')).toBe(true);
      expect(repository.getPartInScope('p1', officer)?.isArchived).toBe(true);
    });

    it('hides a removed part from a supervisor entirely', () => {
      repository.archivePart('p9', 'u1');

      expect(repository.getPartInScope('p9', supervisor)).toBeUndefined();
      expect(repository.listPartsInScope(supervisor).some((part) => part.id === 'p9')).toBe(false);
    });

    it('refuses to edit a removed part', () => {
      repository.archivePart('p1', 'u1');

      expect(repository.updatePart('p1', partInput(), 'u1')).toMatchObject({
        ok: false,
        reason: 'already_archived',
      });
    });

    it('restores a removed part', () => {
      repository.archivePart('p1', 'u1');
      const result = repository.restorePart('p1', 'u1');

      expect(result).toMatchObject({ ok: true });
      expect(repository.getPartInScope('p1', officer)?.isArchived).toBe(false);
    });

    it('refuses to restore a part that is still fitted', () => {
      expect(repository.restorePart('p1', 'u1')).toMatchObject({
        ok: false,
        reason: 'not_archived',
      });
    });
  });

  describe('replacePart', () => {
    it('records the replacement and restarts the life clock', () => {
      const before = repository.getPartInScope('p1', officer);
      const result = repository.replacePart(
        'p1',
        { replacedOn: '2026-07-01', reason: 'Life expiry', newSerialNumber: 'HF220-NEW' },
        'u1',
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.serialNumber).toBe('HF220-NEW');
      expect(result.data.fittedDate).toBe('2026-07-01');

      const history = repository.listPartReplacements('p1');
      expect(history[0]).toMatchObject({
        reason: 'Life expiry',
        previousSerialNumber: before?.serialNumber,
        newSerialNumber: 'HF220-NEW',
        performedBy: 'u1',
      });
    });

    it('keeps earlier replacements and orders newest first', () => {
      const existing = repository.listPartReplacements('p1').length;
      repository.replacePart('p1', { replacedOn: '2026-07-01', reason: 'Second' }, 'u1');
      const history = repository.listPartReplacements('p1');

      expect(history).toHaveLength(existing + 1);
      for (let i = 1; i < history.length; i += 1) {
        expect(new Date(history[i - 1].replacedOn).getTime()).toBeGreaterThanOrEqual(
          new Date(history[i].replacedOn).getTime(),
        );
      }
    });

    it('rejects a replacement serial already used elsewhere', () => {
      const other = repository.listParts().find((part) => part.id === 'p4');
      const result = repository.replacePart(
        'p1',
        { replacedOn: '2026-07-01', reason: 'Swap', newSerialNumber: other?.serialNumber },
        'u1',
      );

      expect(result).toMatchObject({ ok: false, reason: 'duplicate_serial' });
    });

    it('refuses to replace a removed part', () => {
      repository.archivePart('p1', 'u1');

      expect(
        repository.replacePart('p1', { replacedOn: '2026-07-01', reason: 'x' }, 'u1'),
      ).toMatchObject({ ok: false, reason: 'already_archived' });
    });
  });

  describe('part image', () => {
    const upload = { fileName: 'p.png', fileType: 'image/png', fileSize: 900, url: 'blob:p' };

    it('stores one image per part and replaces it on re-upload', () => {
      expect(repository.setPartImage('p1', upload, 'u1').ok).toBe(true);
      expect(repository.getPartImage('p1')).toMatchObject({ fileName: 'p.png' });

      const replaced = repository.setPartImage('p1', { ...upload, fileName: 'p2.png' }, 'u1');
      expect(replaced.ok).toBe(true);
      expect(repository.getPartImage('p1')?.fileName).toBe('p2.png');
    });

    it('removes the image', () => {
      repository.setPartImage('p1', upload, 'u1');
      expect(repository.removePartImage('p1', 'u1').ok).toBe(true);
      expect(repository.getPartImage('p1')).toBeUndefined();
    });

    it('keeps part and machine images separate', () => {
      repository.setPartImage('p1', upload, 'u1');

      expect(repository.getPartImage('p1')).toBeDefined();
      // m1 has its own fixture image, unaffected by the part upload.
      expect(repository.getMachineImage('m1')?.fileName).toBe('hydraulic-press-front.svg');
    });
  });

  describe('parts summary', () => {
    it('counts only parts on machines in the department and scope', () => {
      const summary = repository.getPartsSummary('d3', supervisor);
      const parts = repository.listPartsForDepartment('d3', supervisor);

      expect(summary.total).toBe(parts.length);
      expect(summary.machinesWithParts).toBe(new Set(parts.map((p) => p.machineId)).size);
    });

    it('returns zeroes for a department outside the scope', () => {
      expect(repository.getPartsSummary('d15', supervisor)).toMatchObject({
        total: 0,
        machinesWithParts: 0,
        overdue: 0,
      });
    });

    it('drops a removed part from the count', () => {
      const before = repository.getPartsSummary('d3', supervisor).total;
      repository.archivePart('p9', 'u1');

      expect(repository.getPartsSummary('d3', supervisor).total).toBe(before - 1);
    });
  });
});
