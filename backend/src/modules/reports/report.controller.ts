import type { Request, RequestHandler } from 'express';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import type { ReportScope } from './report.types.js';
import type { ExportService } from './export.service.js';
import type {
  ExportQuery,
  OccupancyQuery,
  OutstandingQuery,
  PaymentQuery,
  PeriodQuery,
  ProcurementQuery,
} from './report.schema.js';
import type { ReportService } from './report.service.js';

const scope = (req: Request): ReportScope => {
  const { user } = requirePrincipal(req);
  return { hotelId: BigInt(user.hotelId), role: user.role };
};
const handle =
  <Q>(action: (scope: ReportScope, query: Q) => Promise<unknown>): RequestHandler =>
  async (req, res) => {
    const data = await action(scope(req), (res.locals.validated as { query: Q }).query);
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, message: 'Report generated successfully', data });
  };
export function reportController(service: ReportService, exporter: ExportService) {
  return {
    dashboard: handle<{ date?: string }>((s, q) => service.dashboard(s, q)),
    revenue: handle<PeriodQuery>((s, q) => service.revenue(s, q)),
    occupancy: handle<OccupancyQuery>((s, q) => service.occupancy(s, q)),
    reservations: handle<PeriodQuery>((s, q) => service.reservations(s, q)),
    payments: handle<PaymentQuery>((s, q) => service.payments(s, q)),
    operations: handle<PeriodQuery>((s, q) => service.operations(s, q)),
    outstanding: handle<OutstandingQuery>((s, q) => service.outstanding(s, q)),
    procurement: handle<ProcurementQuery>((s, q) => service.procurement(s, q)),
    export: (async (req, res) => {
      const result = await exporter.export(
        scope(req),
        (res.locals.validated as { query: ExportQuery }).query,
      );
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Cache-Control': 'private, no-store',
      });
      res.send(result.csv);
    }) satisfies RequestHandler,
  };
}
