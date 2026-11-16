import type { MaterialLine } from "../api/supplies.api.ts";

export function cleaningSuggestions(
  lines: MaterialLine[],
  adults: number,
  children: number,
  rework = false,
) {
  return lines.map((line) => ({
    key: line.itemId,
    itemId: line.itemId,
    quantity: rework
      ? 0
      : Number(
          (
            Number(line.presetQuantity ?? line.quantity) *
            (line.usageBasis === "PER_GUEST" ? adults + children : 1)
          ).toFixed(2),
        ),
  }));
}
