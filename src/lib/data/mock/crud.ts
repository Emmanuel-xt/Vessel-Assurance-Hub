// MOCK: generic list/get/create/update over one table of the demo database.

import type { CrudRepository } from "@/lib/data/repositories";
import type { ID } from "@/lib/types";
import type { DemoData, TableName } from "./schema";
import { db, persist } from "./store";
import { clone, definedOnly, notFound, simulateLatency } from "./utils";

export type Row<K extends TableName> = DemoData[K][number];

export function rows<K extends TableName>(table: K): Row<K>[] {
  return db()[table] as Row<K>[];
}

export function findRow<K extends TableName>(table: K, id: ID): Row<K> | undefined {
  return rows(table).find((row) => row.id === id);
}

export function requireRow<K extends TableName>(table: K, id: ID, entity: string): Row<K> {
  const row = findRow(table, id);
  if (!row) throw notFound(entity, id);
  return row;
}

interface CrudOptions<K extends TableName, C, F, P> {
  /** Human name for error messages, e.g. "Vessel". */
  entity: string;
  /** Builds the stored row from the create input. Throw a RepositoryError to reject. */
  build(input: C): Row<K>;
  matches?(row: Row<K>, filter: F): boolean;
  compare?(a: Row<K>, b: Row<K>): number;
  /** Runs before a patch is applied. Throw a RepositoryError to reject. */
  beforeUpdate?(row: Row<K>, patch: P): void;
  /** Runs after a patch is applied, e.g. to stamp updatedAt. */
  afterUpdate?(row: Row<K>): void;
}

export function crud<K extends TableName, C, F = undefined, P extends object = Partial<C>>(
  table: K,
  options: CrudOptions<K, C, F, P>,
): CrudRepository<Row<K>, C, F, P> {
  return {
    async list(filter) {
      await simulateLatency();
      let result = rows(table);
      if (filter !== undefined && options.matches) result = result.filter((row) => options.matches!(row, filter));
      if (options.compare) result = [...result].sort(options.compare);
      return clone(result);
    },

    async get(id) {
      await simulateLatency();
      const row = findRow(table, id);
      return row ? clone(row) : null;
    },

    async create(input) {
      await simulateLatency();
      const row = options.build(input);
      rows(table).push(row);
      persist();
      return clone(row);
    },

    async update(id, patch) {
      await simulateLatency();
      const row = requireRow(table, id, options.entity);
      options.beforeUpdate?.(row, patch);
      Object.assign(row, definedOnly(patch));
      options.afterUpdate?.(row);
      persist();
      return clone(row);
    },
  };
}

export const activeOnly = (row: { active: boolean }, filter: { activeOnly?: boolean }) =>
  !filter.activeOnly || row.active;

export const byDisplayOrder = (a: { displayOrder: number }, b: { displayOrder: number }) =>
  a.displayOrder - b.displayOrder;
