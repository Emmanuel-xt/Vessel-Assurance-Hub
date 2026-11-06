import { describe, expect, it } from "vitest";
import { moveInOrder, nextDisplayOrder } from "@/lib/services/ordering";

const items = [
  { id: "a", displayOrder: 1 },
  { id: "b", displayOrder: 2 },
  { id: "c", displayOrder: 3 },
];

describe("moveInOrder", () => {
  it("swaps with the neighbour and returns only changed items", () => {
    expect(moveInOrder(items, "c", "up")).toEqual([
      { id: "c", displayOrder: 2 },
      { id: "b", displayOrder: 3 },
    ]);
    expect(moveInOrder(items, "a", "down")).toEqual([
      { id: "b", displayOrder: 1 },
      { id: "a", displayOrder: 2 },
    ]);
  });

  it("does nothing at the ends or for an unknown id", () => {
    expect(moveInOrder(items, "a", "up")).toEqual([]);
    expect(moveInOrder(items, "c", "down")).toEqual([]);
    expect(moveInOrder(items, "zzz", "up")).toEqual([]);
  });

  it("repairs gaps and duplicates while moving", () => {
    const messy = [
      { id: "a", displayOrder: 5 },
      { id: "b", displayOrder: 9 },
      { id: "c", displayOrder: 9 },
    ];
    const changes = moveInOrder(messy, "a", "down");
    const final = Object.fromEntries(messy.map((m) => [m.id, changes.find((c) => c.id === m.id)?.displayOrder ?? m.displayOrder]));
    expect(Object.values(final).sort()).toEqual([1, 2, 3]);
    expect(final.a).toBe(2);
  });
});

describe("nextDisplayOrder", () => {
  it("goes after the highest existing order", () => {
    expect(nextDisplayOrder(items)).toBe(4);
    expect(nextDisplayOrder([])).toBe(1);
  });
});
