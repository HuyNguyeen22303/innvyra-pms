import { randomUUID } from 'node:crypto';
import type { Env } from '../../src/config/env.js';
import { Prisma, type PrismaClient } from '../../src/generated/prisma/client.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';
import { PrismaInventoryRepository } from '../../src/modules/inventory/inventory.repository.js';
import { localHotels, localRoomTypes } from './catalog.js';
import { isLocalDatabaseName } from './config.js';
import {
  defaultCleaningMaterials,
  housekeepingCatalog,
  localMaterialDefaults,
} from './supply-defaults.js';

export async function backfillLocalSupplies(prisma: PrismaClient, env: Env, apply = false) {
  const url = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !isLocalDatabaseName(url.pathname.slice(1))
  )
    throw new Error('Supply backfill requires a local Innvyra database');
  const actual = await prisma.$queryRaw<{ name: string }[]>`SELECT DATABASE() name`;
  if (actual[0]?.name !== url.pathname.slice(1))
    throw new Error('Supply backfill database mismatch');
  return prisma.$transaction(
    async (tx) => {
      const hotels = await tx.hotel.findMany({
        where: { code: { in: localHotels.map((hotel) => hotel.code) } },
        orderBy: { id: 'asc' },
      });
      if (apply && hotels.length)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM hotels WHERE id IN (${Prisma.join(hotels.map((hotel) => hotel.id))}) ORDER BY id FOR UPDATE`,
        );
      const itemChanges: {
        hotelCode: string;
        id: bigint;
        code: string;
        materialType: string;
        previousCategoryId: bigint;
        categoryId: bigint;
      }[] = [];
      const newItems: {
        hotelCode: string;
        code: string;
        quantity: string;
        unit: string;
        unitPrice: string;
      }[] = [];
      const presets: {
        hotelCode: string;
        roomTypeId: bigint;
        roomTypeCode: string;
        materials: ReturnType<typeof defaultCleaningMaterials>;
      }[] = [];
      const convertedPresets: {
        id: bigint;
        previousQuantity: string;
        quantity: string;
        usageBasis: string;
      }[] = [];
      const removedLegacyPresets: bigint[] = [];
      const receipts: {
        hotelCode: string;
        receiptId: string;
        receiptNumber: string;
        totalAmount: string;
      }[] = [];
      const unchangedLiquidUnits: { hotelCode: string; code: string; unit: string }[] = [];
      let descriptionsFilled = 0;
      for (const hotel of hotels) {
        const [existingItems, categories, types, roomCount] = await Promise.all([
          tx.inventoryItem.findMany({ where: { hotelId: hotel.id } }),
          tx.inventoryCategory.findMany({ where: { hotelId: hotel.id } }),
          tx.roomType.findMany({
            where: {
              hotelId: hotel.id,
              code: { in: localRoomTypes.map((type) => type.code) },
              isActive: true,
            },
            include: { housekeepingPresets: true },
          }),
          tx.room.count({ where: { hotelId: hotel.id, isActive: true } }),
        ]);
        const items: {
          id: bigint | string;
          code: string;
          name: string;
          unit: string;
          isActive: boolean;
          materialType: string;
        }[] = [...existingItems];
        for (const item of existingItems) {
          const definition = localMaterialDefaults.find(
            (definition) => definition.code === item.code && definition.name === item.name,
          );
          if (!definition) continue;
          if (
            ['ITEM_4', 'ITEM_5', 'ITEM_6'].includes(item.code) &&
            item.unit.toLowerCase() !== 'ml'
          )
            unchangedLiquidUnits.push({ hotelCode: hotel.code, code: item.code, unit: item.unit });
          const category = categories.find(
            (category) => category.code === definition.category && category.isActive,
          );
          if (item.materialType === 'UNCLASSIFIED') {
            const categoryId = category?.id ?? item.categoryId;
            itemChanges.push({
              hotelCode: hotel.code,
              id: item.id,
              code: item.code,
              materialType: definition.materialType,
              previousCategoryId: item.categoryId,
              categoryId,
            });
            if (apply)
              await tx.inventoryItem.update({
                where: { hotelId: hotel.id, id: item.id },
                data: {
                  materialType: definition.materialType,
                  categoryId,
                  updatedAt: item.updatedAt,
                },
              });
            item.materialType = definition.materialType;
            item.categoryId = categoryId;
          }
          const description =
            item.code === 'ITEM_1'
              ? 'Tham chiếu 1 khăn tắm/khách; thay, thu hồi và giặt theo quy trình đồ vải, không tiêu hao mỗi lượt dọn.'
              : item.code === 'ITEM_2'
                ? 'Gợi ý 1 dầu gội mini/khách; chỉ xuất số chai thực cấp mới.'
                : item.code === 'ITEM_3'
                  ? 'Gợi ý 1 bàn chải/khách; kem đánh răng theo mã riêng, chọn sản phẩm phù hợp độ tuổi.'
                  : null;
          if (description && !item.description) {
            descriptionsFilled++;
            if (apply)
              await tx.inventoryItem.update({
                where: { hotelId: hotel.id, id: item.id },
                data: { description, updatedAt: item.updatedAt },
              });
          }
        }
        const received: { itemId: string; quantity: string; unitPrice: string }[] = [];
        for (const definition of housekeepingCatalog) {
          const known = existingItems.find((item) => item.code === definition.code);
          if (known) {
            if (known.name !== definition.name || known.unit !== definition.unit) continue;
            if (known.materialType === 'UNCLASSIFIED') {
              const category = categories.find(
                (category) => category.code === definition.category && category.isActive,
              );
              const categoryId = category?.id ?? known.categoryId;
              itemChanges.push({
                hotelCode: hotel.code,
                id: known.id,
                code: known.code,
                materialType: definition.materialType,
                previousCategoryId: known.categoryId,
                categoryId,
              });
              if (apply)
                await tx.inventoryItem.update({
                  where: { hotelId: hotel.id, id: known.id },
                  data: {
                    materialType: definition.materialType,
                    categoryId,
                    updatedAt: known.updatedAt,
                  },
                });
              known.materialType = definition.materialType;
            }
            continue;
          }
          let category = categories.find((category) => category.code === definition.category);
          if (category && !category.isActive)
            throw new Error(`Supply backfill inactive category: ${definition.category}`);
          if (!category && apply) {
            category = await tx.inventoryCategory.create({
              data: {
                hotelId: hotel.id,
                code: definition.category,
                name: {
                  AMENITY: 'Đồ dùng phòng',
                  CLEANING: 'Vật tư vệ sinh',
                  LINEN: 'Đồ vải',
                  EQUIPMENT: 'Dụng cụ buồng phòng',
                }[definition.category],
              },
            });
            categories.push(category);
          }
          const factor = Math.max(roomCount, 1) / 24;
          const quantity = String(Math.max(1, Math.round(definition.initialQuantity * factor)));
          const row = apply
            ? await tx.inventoryItem.create({
                data: {
                  hotelId: hotel.id,
                  categoryId: category!.id,
                  code: definition.code,
                  name: definition.name,
                  unit: definition.unit,
                  materialType: definition.materialType,
                  description: definition.description,
                  minStockLevel: Math.max(1, Math.round(definition.minStock * factor)),
                },
              })
            : { ...definition, id: `NEW:${definition.code}`, isActive: true };
          items.push(row);
          newItems.push({
            hotelCode: hotel.code,
            code: definition.code,
            quantity,
            unit: definition.unit,
            unitPrice: definition.unitPrice,
          });
          received.push({ itemId: String(row.id), quantity, unitPrice: definition.unitPrice });
        }
        if (apply && received.length) {
          const [actor, supplier] = await Promise.all([
            tx.staffUser.findFirst({
              where: { hotelId: hotel.id, isActive: true, role: { code: 'ADMIN' } },
              orderBy: { id: 'asc' },
            }),
            tx.supplier.findFirst({
              where: { hotelId: hotel.id, isActive: true },
              orderBy: { id: 'asc' },
            }),
          ]);
          if (!actor || !supplier)
            throw new Error('Supply backfill requires an active hotel admin and supplier');
          const receipt = await new InventoryService(
            new PrismaInventoryRepository(prisma, tx),
          ).createReceipt(
            { hotelId: hotel.id, actorId: actor.id, role: 'ADMIN' },
            {
              receiptNumber: `NHAP-BP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
              supplierId: String(supplier.id),
              items: received,
              notes:
                'Nhập bổ sung đồ dùng phòng, đồ vải và dụng cụ phục vụ buồng phòng. Chưa thanh toán nhà cung cấp.',
            },
          );
          receipts.push({
            hotelCode: hotel.code,
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            totalAmount: receipt.totalAmount,
          });
        }
        for (const type of types) {
          let changed = false;
          const existing = [...type.housekeepingPresets];
          for (const row of existing) {
            const item = items.find((item) => String(item.id) === String(row.itemId));
            if (
              item &&
              ['ITEM_2', 'ITEM_3'].includes(item.code) &&
              row.usageBasis === 'PER_ROOM' &&
              row.quantity.equals(type.maxAdults)
            ) {
              convertedPresets.push({
                id: row.id,
                previousQuantity: row.quantity.toFixed(2),
                quantity: '1.00',
                usageBasis: 'PER_GUEST',
              });
              if (apply)
                await tx.housekeepingMaterialPreset.update({
                  where: { id: row.id },
                  data: { quantity: '1.00', usageBasis: 'PER_GUEST' },
                });
              changed = true;
            }
          }
          const oldFloor = existing.find(
            (row) =>
              items.find((item) => String(item.id) === String(row.itemId))?.code === 'ITEM_4',
          );
          const replaceFloor =
            oldFloor &&
            oldFloor.usageBasis === 'PER_ROOM' &&
            oldFloor.quantity.equals(type.code === 'SUITE' ? 100 : 50);
          if (replaceFloor) {
            removedLegacyPresets.push(oldFloor.id);
            if (apply) await tx.housekeepingMaterialPreset.delete({ where: { id: oldFloor.id } });
            changed = true;
          }
          const materials = defaultCleaningMaterials(type, items).filter(
            (line) =>
              !existing.some((row) => String(row.itemId) === line.itemId) &&
              !(
                oldFloor &&
                !replaceFloor &&
                items.find((item) => String(item.id) === line.itemId)?.code === 'HK_FLOOR_RTU'
              ),
          );
          if (materials.length) {
            if (apply)
              await tx.housekeepingMaterialPreset.createMany({
                data: materials.map((line) => ({
                  hotelId: hotel.id,
                  roomTypeId: type.id,
                  itemId: BigInt(line.itemId),
                  quantity: line.quantity,
                  usageBasis: line.usageBasis,
                })),
              });
            changed = true;
          }
          if (changed)
            presets.push({
              hotelCode: hotel.code,
              roomTypeId: type.id,
              roomTypeCode: type.code,
              materials,
            });
        }
      }
      return {
        applied: apply,
        database: actual[0]!.name,
        itemsClassified: itemChanges.length,
        itemsCreated: newItems.length,
        roomTypesConfigured: presets.length,
        presetLinesAdded: presets.reduce((sum, row) => sum + row.materials.length, 0),
        presetLinesUpdated: convertedPresets.length,
        presetLinesRemoved: removedLegacyPresets.length,
        itemChanges,
        newItems,
        presets,
        convertedPresets,
        removedLegacyPresets,
        receipts,
        unchangedLiquidUnits,
        descriptionsFilled,
      };
    },
    { isolationLevel: 'ReadCommitted', timeout: 60000 },
  );
}
