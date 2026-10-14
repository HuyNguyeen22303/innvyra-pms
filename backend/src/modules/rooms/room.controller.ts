import type { RequestHandler } from 'express';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import type { RoomService } from './room.service.js';
import type { CreateRoomInput, UpdateRoomInput, RoomQuery } from './room.types.js';

export function roomController(service: RoomService) {
  const list: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: RoomQuery };
    res.json({
      success: true,
      message: 'Rooms retrieved',
      data: await service.getRooms(BigInt(requirePrincipal(req).user.hotelId), query),
    });
  };
  const detail: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    res.json({
      success: true,
      message: 'Room retrieved',
      data: await service.getRoomById(
        BigInt(requirePrincipal(req).user.hotelId),
        BigInt(params.id),
      ),
    });
  };
  const create: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateRoomInput };
    const data = await service.createRoom(BigInt(requirePrincipal(req).user.hotelId), body);
    res.status(201).json({ success: true, message: 'Room created', data });
  };
  const update: RequestHandler = async (req, res) => {
    const { body, params } = res.locals.validated as {
      body: UpdateRoomInput;
      params: { id: string };
    };
    res.json({
      success: true,
      message: 'Room updated',
      data: await service.updateRoom(
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
      message: 'Room deactivated; record retained',
      data: await service.deactivateRoom(
        BigInt(requirePrincipal(req).user.hotelId),
        BigInt(params.id),
      ),
    });
  };
  return { list, detail, create, update, deactivate };
}
