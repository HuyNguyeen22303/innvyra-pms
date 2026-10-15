import { describe, expect, it } from 'vitest';
import {
  createTaskBody,
  inspectBody,
  taskQuery,
} from '../src/modules/housekeeping/housekeeping.schema.js';
import {
  blockQuery,
  createBlockBody,
  createTicketBody,
  releaseBody,
  resolveBody,
  ticketQuery,
} from '../src/modules/maintenance/maintenance.schema.js';
import { openApiDocument } from '../src/config/swagger.js';

describe('Operations input boundaries and API contract', () => {
  it.each(['0', '-1', '01', '1.5', '18446744073709551616', 'abc'])(
    'rejects invalid room ID %s',
    (roomId) => {
      expect(createTaskBody.safeParse({ roomId }).success).toBe(false);
      expect(
        createBlockBody.safeParse({
          roomId,
          startDate: '2026-11-01',
          endDate: '2026-11-02',
          reason: 'Repair',
        }).success,
      ).toBe(false);
    },
  );
  it.each(['hotelId', 'createdBy', 'reportedBy', 'assignedTo', 'role', 'status', 'physicalStatus'])(
    'rejects privileged field %s',
    (field) => {
      expect(createTaskBody.safeParse({ roomId: '1', [field]: '2' }).success).toBe(false);
      expect(
        createTicketBody.safeParse({
          roomId: '1',
          title: 'Issue',
          description: 'Broken',
          [field]: '2',
        }).success,
      ).toBe(false);
    },
  );
  it('supports turnover only and requires a reason for failed inspection', () => {
    expect(createTaskBody.safeParse({ roomId: '1', taskType: 'STAYOVER_CLEANING' }).success).toBe(
      false,
    );
    expect(inspectBody.safeParse({ passed: false }).success).toBe(false);
    expect(inspectBody.safeParse({ passed: false, notes: '   ' }).success).toBe(false);
    expect(inspectBody.safeParse({ passed: true }).success).toBe(true);
  });
  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2026-11-02', '2026-11-01'],
    ['2026-11-01', '2026-11-01'],
    ['2026-01-01', '2028-01-01'],
    ['2026-11-01T00:00:00Z', '2026-11-02'],
  ])('rejects invalid maintenance dates %s to %s', (startDate, endDate) => {
    expect(
      createBlockBody.safeParse({ roomId: '1', startDate, endDate, reason: 'Repair' }).success,
    ).toBe(false);
  });
  it('bounds pagination, filters, sorting, notes and resolution safety attestations', () => {
    for (const query of [
      { page: '0' },
      { limit: '101' },
      { sortBy: 'passwordHash' },
      { hotelId: '2' },
      { assignedTo: ['1', '2'] },
    ]) {
      expect(taskQuery.safeParse(query).success).toBe(false);
      expect(ticketQuery.safeParse(query).success).toBe(false);
    }
    expect(blockQuery.safeParse({ fromDate: '2026-11-02', toDate: '2026-11-01' }).success).toBe(
      false,
    );
    expect(resolveBody.safeParse({ resolutionNotes: '' }).success).toBe(false);
    expect(releaseBody.safeParse({}).success).toBe(false);
    expect(inspectBody.safeParse({ passed: false, notes: 'x'.repeat(2001) }).success).toBe(false);
  });
  it('keeps every OpenAPI schema reference resolvable, including Operations responses', () => {
    const serialized = JSON.stringify(openApiDocument);
    for (const match of serialized.matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g))
      expect(openApiDocument.components.schemas).toHaveProperty(match[1]!);
    expect(openApiDocument.tags.map((t) => t.name)).toEqual(
      expect.arrayContaining(['Housekeeping', 'Maintenance']),
    );
  });
});
