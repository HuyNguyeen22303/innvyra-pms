import type { Request, RequestHandler } from 'express';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import type { StayService } from './stay.service.js';
import type {
  StayScope,
  StayQuery,
  CheckinInput,
  CheckoutInput,
  TransferInput,
} from './stay.types.js';

const scope = (req: Request): StayScope => {
  const { user } = requirePrincipal(req);
  return { hotelId: BigInt(user.hotelId), actorId: BigInt(user.id), role: user.role };
};
export function stayController(service: StayService) {
  const list: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: StayQuery };
    res.json({
      success: true,
      message: 'Stays retrieved',
      data: await service.list(scope(req), query),
    });
  };
  const detail: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    res.json({
      success: true,
      message: 'Stay retrieved',
      data: await service.detail(scope(req), BigInt(params.id)),
    });
  };
  const checkin: RequestHandler = async (req, res) => {
    const { params, body } = res.locals.validated as {
      params: { reservationId: string; reservationRoomId: string };
      body: CheckinInput;
    };
    const data = await service.checkin(
      scope(req),
      BigInt(params.reservationId),
      BigInt(params.reservationRoomId),
      body,
    );
    res.status(201).json({ success: true, message: 'Check-in successful', data });
  };
  const checkout: RequestHandler = async (req, res) => {
    const { params, body } = res.locals.validated as {
      params: { id: string };
      body: CheckoutInput;
    };
    res.json({
      success: true,
      message: 'Check-out successful',
      data: await service.checkout(scope(req), BigInt(params.id), body),
    });
  };
  const transfer: RequestHandler = async (req, res) => {
    const { params, body } = res.locals.validated as {
      params: { id: string };
      body: TransferInput;
    };
    res
      .status(201)
      .json({
        success: true,
        message: 'Room transferred successfully',
        data: await service.transfer(scope(req), BigInt(params.id), body),
      });
  };
  return { list, detail, checkin, checkout, transfer };
}
