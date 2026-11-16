import { describe, expect, it } from 'vitest';
import { defaultCleaningMaterials } from '../scripts/local-seed/supply-defaults.js';

const items = [
  {
    id: '2',
    code: 'ITEM_2',
    name: 'Dầu gội mini',
    unit: 'cái',
    isActive: true,
    materialType: 'CONSUMABLE',
  },
  {
    id: '3',
    code: 'ITEM_3',
    name: 'Bàn chải',
    unit: 'cái',
    isActive: true,
    materialType: 'CONSUMABLE',
  },
  {
    id: '4',
    code: 'ITEM_4',
    name: 'Nước lau sàn',
    unit: 'chai',
    isActive: true,
    materialType: 'CONSUMABLE',
  },
];
describe('Local cleaning configuration shared by seed and backfill', () => {
  it('sets amenities by room capacity without guessing the volume of old bottles', () => {
    expect(defaultCleaningMaterials({ code: 'SUITE', maxAdults: 4 }, items)).toEqual([
      { itemId: '2', quantity: '1.00', usageBasis: 'PER_GUEST' },
      { itemId: '3', quantity: '1.00', usageBasis: 'PER_GUEST' },
    ]);
  });
  it('adds chemical usage only when its existing unit is ml', () => {
    const measured = items.map((item) => (item.code === 'ITEM_4' ? { ...item, unit: 'ml' } : item));
    expect(defaultCleaningMaterials({ code: 'STD_DBL', maxAdults: 2 }, measured).at(-1)).toEqual({
      itemId: '4',
      quantity: '50.00',
      usageBasis: 'PER_ROOM',
    });
    expect(defaultCleaningMaterials({ code: 'SUITE', maxAdults: 4 }, measured).at(-1)).toEqual({
      itemId: '4',
      quantity: '100.00',
      usageBasis: 'PER_ROOM',
    });
  });
  it('does not configure inactive, renamed or manually reclassified items', () => {
    const changed = items.map((item, index) =>
      index === 0
        ? { ...item, isActive: false }
        : index === 1
          ? { ...item, materialType: 'REUSABLE' }
          : { ...item, name: 'Vật tư khác', unit: 'ml' },
    );
    expect(defaultCleaningMaterials({ code: 'STD_DBL', maxAdults: 2 }, changed)).toEqual([]);
  });
});
