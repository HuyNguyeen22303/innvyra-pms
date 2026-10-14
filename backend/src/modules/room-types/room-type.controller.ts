import type { RequestHandler } from 'express';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import type { RoomTypeService } from './room-type.service.js';
import type { CreateRoomTypeInput, UpdateRoomTypeInput, RoomTypeQuery } from './room-type.types.js';

export function roomTypeController(service: RoomTypeService) {
  const list: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: RoomTypeQuery };
    res.json({
      success: true,
      message: 'Room types retrieved',
      data: await service.getRoomTypes(BigInt(requirePrincipal(req).user.hotelId), query),
    });
  };
  const detail: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    res.json({
      success: true,
      message: 'Room type retrieved',
      data: await service.getRoomTypeById(
        BigInt(requirePrincipal(req).user.hotelId),
        BigInt(params.id),
      ),
    });
  };
  const create: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateRoomTypeInput };
    const data = await service.createRoomType(BigInt(requirePrincipal(req).user.hotelId), body);
    res.status(201).json({ success: true, message: 'Room type created', data });
  };
  const update: RequestHandler = async (req, res) => {
    const { body, params } = res.locals.validated as {
      body: UpdateRoomTypeInput;
      params: { id: string };
    };
    res.json({
      success: true,
      message: 'Room type updated',
      data: await service.updateRoomType(
        BigInt(requirePrincipal(req).user.hotelId),
        BigInt(params.id),
        body,
      ),
    });
  };
  const deactivate: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    res.json({
      success: true,
      message: 'Room type deactivated; record retained',
      data: await service.deactivateRoomType(
        BigInt(requirePrincipal(req).user.hotelId),
        BigInt(params.id),
      ),
    });
  };
  return { list, detail, create, update, deactivate };
}
