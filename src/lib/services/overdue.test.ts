import { describe, expect, it } from "vitest";
import { businessToday, isOverdue } from "@/lib/services/overdue";

describe("overdue", () => {
  const now = new Date("2026-11-05T10:00:00Z");

  it("uses the Lagos calendar date", () => {
    expect(businessToday(now)).toBe("2026-11-05");
    expect(businessToday(new Date("2026-11-05T23:30:00Z"))).toBe("2026-11-06"); // 00:30 in Lagos
  });

  it("is overdue only after the target date and while not closed", () => {
    expect(isOverdue({ status: "OPEN", targetDate: "2026-11-04" }, now)).toBe(true);
    expect(isOverdue({ status: "IN_PROGRESS", targetDate: "2026-11-04" }, now)).toBe(true);
    expect(isOverdue({ status: "OPEN", targetDate: "2026-11-05" }, now)).toBe(false);
    expect(isOverdue({ status: "CLOSED", targetDate: "2026-01-01" }, now)).toBe(false);
  });
});
