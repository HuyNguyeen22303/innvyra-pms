import assert from "node:assert/strict";
import { test } from "node:test";
import { cleaningSuggestions } from "../src/utils/housekeepingMaterials.ts";
import type { MaterialLine } from "../src/api/supplies.api.ts";
const item = {
  id: "1",
  code: "BRUSH",
  name: "Bàn chải",
  unit: "cái",
  currentStock: "100.00",
  isActive: true,
  materialType: "CONSUMABLE" as const,
};
const lines: MaterialLine[] = [
  {
    itemId: "1",
    quantity: "2.00",
    presetQuantity: "1.00",
    usageBasis: "PER_GUEST",
    item,
  },
  {
    itemId: "2",
    quantity: "50.25",
    presetQuantity: "50.25",
    usageBasis: "PER_ROOM",
    item: { ...item, id: "2", unit: "ml" },
  },
];
test("preparation uses selected adults and children, while per-room chemicals remain constant", () => {
  assert.deepEqual(
    cleaningSuggestions(lines, 1, 0).map((line) => line.quantity),
    [1, 50.25],
  );
  assert.deepEqual(
    cleaningSuggestions(lines, 2, 1).map((line) => line.quantity),
    [3, 50.25],
  );
  assert.deepEqual(
    cleaningSuggestions(lines, 4, 2).map((line) => line.quantity),
    [6, 50.25],
  );
});
test("rework starts with zero additional consumption instead of issuing another full room setup", () => {
  assert.deepEqual(
    cleaningSuggestions(lines, 2, 1, true).map((line) => line.quantity),
    [0, 0],
  );
});
