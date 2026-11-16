import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { issueView } from './inventory.types.js';
import type { InventoryOperations, InventoryScope, CreateIssueInput } from './inventory.types.js';

export async function postStockIssue(
  repo: InventoryOperations,
  scope: InventoryScope,
  input: CreateIssueInput,
  completionId?: bigint,
) {
  const issueNumber =
    input.issueNumber?.trim() ||
    `ISS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const existingIssue = await repo.findIssueByNumber(scope.hotelId, issueNumber);
  if (existingIssue) {
    throw new AppError(
      409,
      'ISSUE_NUMBER_EXISTS',
      `Issue number ${issueNumber} already exists in this hotel`,
    );
  }

  // Collect item IDs and lock items FOR UPDATE (concurrency control)
  const itemIds = Array.from(new Set(input.items.map((i) => BigInt(i.itemId))));
  const lockedItems = await repo.lockItemsForUpdate(scope.hotelId, itemIds);
  const itemMap = new Map(lockedItems.map((item) => [item.id, item]));

  // Verify all items exist and are active
  for (const line of input.items) {
    const item = itemMap.get(BigInt(line.itemId));
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', `Item with ID ${line.itemId} not found`);
    }
    if (!item.isActive) {
      throw new AppError(
        409,
        'ITEM_INACTIVE',
        `Item ${item.name} (${item.code}) is inactive and cannot be issued`,
      );
    }
  }

  // Aggregate requested quantities per itemId to handle duplicate lines in the same request
  const requestedQuantities = new Map<bigint, Prisma.Decimal>();
  for (const line of input.items) {
    const id = BigInt(line.itemId);
    const qty = new Prisma.Decimal(line.quantity);
    const current = requestedQuantities.get(id) ?? new Prisma.Decimal('0.00');
    requestedQuantities.set(id, current.add(qty));
  }

  // Check sufficient stock for EVERY item - fail fast if any item is insufficient!
  for (const [id, reqQty] of requestedQuantities.entries()) {
    const item = itemMap.get(id)!;
    if (item.currentStock.lessThan(reqQty)) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        `Insufficient stock for item "${item.name}" (${item.code}). Available: ${item.currentStock.toString()}, Requested: ${reqQty.toString()}`,
        [
          { path: 'itemName', message: item.name },
          { path: 'unit', message: item.unit },
          { path: 'available', message: item.currentStock.toFixed(2) },
          { path: 'requested', message: reqQty.toFixed(2) },
        ],
      );
    }
  }

  // Prepare line items
  const preparedLines = input.items.map((line) => ({
    itemId: BigInt(line.itemId),
    quantity: new Prisma.Decimal(line.quantity),
    notes: line.notes ?? null,
  }));

  // Create issue
  const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();
  const issue = await repo.createIssue(
    {
      hotelId: scope.hotelId,
      issueNumber,
      ...(completionId != null ? { housekeepingCompletionId: completionId } : {}),
      issueDate,
      department: input.department,
      purpose: input.purpose ?? null,
      notes: input.notes ?? null,
      createdBy: scope.actorId,
    },
    preparedLines,
  );

  // Decrease stock and create movements for aggregated items
  for (const [id, reqQty] of requestedQuantities.entries()) {
    const item = itemMap.get(id)!;
    const prevStock = item.currentStock;
    const newStock = prevStock.sub(reqQty);

    if (newStock.isNegative()) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        `Stock cannot become negative for item "${item.name}" (${item.code})`,
      );
    }

    await repo.updateItem(scope.hotelId, id, {
      currentStock: newStock,
    });

    await repo.createMovement({
      hotelId: scope.hotelId,
      itemId: id,
      type: 'ISSUE',
      quantity: reqQty.negated(),
      previousStock: prevStock,
      currentStock: newStock,
      referenceType: 'STOCK_ISSUE',
      referenceId: issue.id,
      referenceNumber: issue.issueNumber,
      notes: `Issued to ${input.department}${input.purpose ? ` (${input.purpose})` : ''}`,
      createdBy: scope.actorId,
    });
  }

  return issueView(issue);
}
