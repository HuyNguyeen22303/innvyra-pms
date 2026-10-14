import type { Request, RequestHandler } from 'express';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import type { ReservationService } from './reservation.service.js';
import type {
  AvailabilityQuery,
  CancelReservationInput,
  CreateReservationInput,
  ReservationQuery,
  ReservationScope,
} from './reservation.types.js';

const scope = (req: Request): ReservationScope => {
  const { user } = requirePrincipal(req);
  return { hotelId: BigInt(user.hotelId), actorId: BigInt(user.id), role: user.role };
};
export function reservationController(service: ReservationService) {
  const availability: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: AvailabilityQuery };
    res.json({
      success: true,
      message: 'Availability retrieved; subject to confirmation',
      data: await service.availability.search(scope(req), query),
    });
  };
  const create: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateReservationInput };
    res
      .status(201)
      .json({
        success: true,
        message: 'Reservation created successfully',
        data: await service.create(scope(req), body),
      });
  };
  const list: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: ReservationQuery };
    res.json({
      success: true,
      message: 'Reservations retrieved',
      data: await service.list(scope(req), query),
    });
  };
  const detail: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    res.json({
      success: true,
      message: 'Reservation retrieved',
      data: await service.detail(scope(req), BigInt(params.id)),
    });
  };
  const cancel: RequestHandler = async (req, res) => {
    const { params, body } = res.locals.validated as {
      params: { id: string };
      body: CancelReservationInput;
    };
    res.json({
      success: true,
      message: 'Reservation cancelled successfully',
      data: await service.cancel(scope(req), BigInt(params.id), body),
    });
  };
  return { availability, create, list, detail, cancel };
}
