// Display-order rules shared by modules and questions.

import type { ID } from "@/lib/types";

export type MoveDirection = "up" | "down";

interface Ordered {
  id: ID;
  displayOrder: number;
}

/**
 * Moves one item up or down a list and renumbers the whole list 1..n.
 * Returns only the items whose displayOrder changed (empty if the move is not possible).
 */
export function moveInOrder(items: Ordered[], id: ID, direction: MoveDirection): Ordered[] {
  const sorted = [...items].sort((a, b) => a.displayOrder - b.displayOrder);
  const from = sorted.findIndex((item) => item.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= sorted.length) return [];

  [sorted[from], sorted[to]] = [sorted[to], sorted[from]];
  return sorted.flatMap((item, index) =>
    item.displayOrder === index + 1 ? [] : [{ id: item.id, displayOrder: index + 1 }],
  );
}

/** Display order for a new item added at the end. */
export function nextDisplayOrder(items: Pick<Ordered, "displayOrder">[]): number {
  return items.reduce((max, item) => Math.max(max, item.displayOrder), 0) + 1;
}
