import type { Env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { reportAccess, type ReportService } from './report.service.js';
import type { ExportQuery } from './report.schema.js';
import type { ReportScope } from './report.types.js';

export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);
  // Quote all cells; escape formula prefixes even after whitespace/control characters.
  // Trusted decimal values (including negative balances) keep their exact representation.
  if (!/^-?\d+(\.\d+)?$/.test(text) && /^[=+@-]/u.test(text.replace(/^[\s\p{Cc}]*/u, '')))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export class ExportService {
  constructor(
    private readonly reports: ReportService,
    private readonly env: Env,
  ) {}
  async export(scope: ReportScope, query: ExportQuery) {
    reportAccess(scope, query.type, true);
    const data = await this.reports.report(query.type, scope, query);
    if (data.series.length > this.env.REPORT_EXPORT_MAX_ROWS)
      throw new AppError(422, 'REPORT_RANGE_TOO_LARGE', 'Export exceeds configured row limit');
    const columns = Object.keys(data.series[0]!);
    const metadata = [
      'startDate',
      'endDateExclusive',
      'timezone',
      'currency',
      'groupBy',
      'dataQuality',
      'limitations',
    ];
    const suffix = [
      query.startDate,
      query.endDate,
      data.timezone,
      data.currency,
      query.groupBy,
      data.dataQuality.status,
      data.dataQuality.limitations.join(' | '),
    ];
    const rows = [
      [...columns, ...metadata],
      ...data.series.map((row) => [
        ...columns.map((key) => (row as Record<string, unknown>)[key]),
        ...suffix,
      ]),
    ];
    return {
      filename: `innvyra-${query.type}-${query.startDate}-${query.endDate}.csv`,
      csv: '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n',
    };
  }
}
