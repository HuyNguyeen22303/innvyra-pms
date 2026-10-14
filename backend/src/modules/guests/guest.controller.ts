import type { Request, RequestHandler } from 'express';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import type { GuestService } from './guest.service.js';
import type { CreateGuestInput, UpdateGuestInput, GuestQuery, GuestScope } from './guest.types.js';

function scope(req: Request): GuestScope {
  const { user } = requirePrincipal(req);
  return { hotelId: BigInt(user.hotelId), actorId: BigInt(user.id), role: user.role };
}
export function guestController(service: GuestService) {
  const createGuest: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateGuestInput };
    const result = await service.createGuest(scope(req), body);
    res.status(201).json({
      success: true,
      message: 'Guest created',
      data: result.guest,
      warnings: result.warnings,
    });
  };
  const getGuests: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: GuestQuery };
    res.json({
      success: true,
      message: 'Guests retrieved',
      data: await service.getGuests(scope(req), query),
    });
  };
  const getGuestById: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    res.json({
      success: true,
      message: 'Guest retrieved',
      data: await service.getGuestById(scope(req), BigInt(params.id)),
    });
  };
  const updateGuest: RequestHandler = async (req, res) => {
    const { params, body } = res.locals.validated as {
      params: { id: string };
      body: UpdateGuestInput;
    };
    const result = await service.updateGuest(scope(req), BigInt(params.id), body);
    res.json({
      success: true,
      message: 'Guest updated',
      data: result.guest,
      warnings: result.warnings,
    });
  };
  const deleteGuest: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    res.json({
      success: true,
      message: 'Guest soft deleted; record retained',
      data: await service.deleteGuest(scope(req), BigInt(params.id)),
    });
  };
  return { createGuest, getGuests, getGuestById, updateGuest, deleteGuest };
}
