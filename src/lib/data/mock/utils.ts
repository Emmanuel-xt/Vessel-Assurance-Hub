// MOCK: helpers for the mock repositories (latency, ids, timestamps, copies).

import { RepositoryError } from "@/lib/data/repositories";
import type { ID } from "@/lib/types";

const latency = { min: 200, max: 400 };

/** MOCK: change the simulated network delay (tests use 0). */
export function setMockDelay(min: number, max: number = min): void {
  latency.min = min;
  latency.max = max;
}

/** MOCK: waits 200–400 ms so loading states look real. */
export function simulateLatency(): Promise<void> {
  const ms = latency.min + Math.random() * (latency.max - latency.min);
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Random UUID v4. Uses getRandomValues rather than crypto.randomUUID, because randomUUID is unavailable
 * on plain-http LAN addresses (e.g. a phone opening http://192.168.x.x:3000).
 */
export function newId(): ID {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Deep copy so callers can never mutate stored records. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Drops undefined values so a partial patch never blanks a field. */
export function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function notFound(entity: string, id: ID): RepositoryError {
  return new RepositoryError("NOT_FOUND", `${entity} ${id} not found`);
}
