import { describe, expect, it } from "vitest";
import { formatActionReference, formatReference, referenceYear } from "@/lib/services/references";

describe("references", () => {
  it("formats each kind with a 4-digit sequence", () => {
    expect(formatReference("assessment", 2026, 1)).toBe("VAH-A-2026-0001");
    expect(formatReference("finding", 2026, 42)).toBe("VAH-F-2026-0042");
    expect(formatReference("positiveIntervention", 2027, 12345)).toBe("VAH-P-2027-12345");
  });

  it("formats action references from the finding reference", () => {
    expect(formatActionReference("VAH-F-2026-0042", 2)).toBe("VAH-F-2026-0042-A2");
  });

  it("rejects invalid sequence numbers", () => {
    expect(() => formatReference("finding", 2026, 0)).toThrow();
    expect(() => formatActionReference("VAH-F-2026-0001", 1.5)).toThrow();
  });

  it("uses the Lagos calendar year (UTC+1)", () => {
    // 23:30 UTC on 31 Dec is already 00:30 on 1 Jan in Lagos.
    expect(referenceYear(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
    expect(referenceYear(new Date("2026-12-31T22:30:00Z"))).toBe(2026);
  });
});
