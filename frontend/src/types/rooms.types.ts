export type PhysicalStatus = 'ACTIVE' | 'OUT_OF_SERVICE' | 'MAINTENANCE';
export type HousekeepingStatus = 'DIRTY' | 'CLEANING' | 'INSPECTION' | 'READY';
export type OccupancyStatus = 'OCCUPIED' | 'VACANT';

export interface RoomTypeItem {
  id: string;
  hotelId: string;
  code: string;
  name: string;
  description: string | null;
  maxAdults: number;
  maxChildren: number;
  basePrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomTypeDto {
  code: string;
  name: string;
  description?: string;
  maxAdults: number;
  maxChildren?: number;
  basePrice: number | string;
  isActive?: boolean;
}

export type UpdateRoomTypeDto = Partial<CreateRoomTypeDto>;

export interface RoomItem {
  id: string;
  hotelId: string;
  roomTypeId: string;
  roomNumber: string;
  floorNumber: number;
  physicalStatus: PhysicalStatus;
  housekeepingStatus: HousekeepingStatus;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roomType: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  };
  occupancyStatus: OccupancyStatus;
}

export interface CreateRoomDto {
  roomNumber: string;
  floorNumber: number;
  roomTypeId: string;
  physicalStatus?: PhysicalStatus;
  housekeepingStatus?: HousekeepingStatus;
  notes?: string;
  isActive?: boolean;
}

export type UpdateRoomDto = Partial<CreateRoomDto>;

export interface RoomFilterParams {
  search?: string;
  roomTypeId?: string;
  floorNumber?: number;
  physicalStatus?: PhysicalStatus;
  housekeepingStatus?: HousekeepingStatus;
  sortBy?: 'roomNumber' | 'floorNumber' | 'createdAt';
}
