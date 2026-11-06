import { describe, expect, it } from "vitest";
import { formatCalendarDate, formatDate, formatDateTime } from "./format";

describe("date formatting (dd MMM yyyy, Lagos)", () => {
  it("uses three-letter months, including Sep", () => {
    expect(formatDate("2026-09-27T10:00:00Z")).toBe("27 Sep 2026");
    expect(formatCalendarDate("2026-11-05")).toBe("05 Nov 2026");
  });

  it("shows Lagos time (UTC+1), which can move the date", () => {
    expect(formatDate("2026-12-31T23:30:00Z")).toBe("01 Jan 2027");
    expect(formatDateTime("2026-05-09T12:28:00Z")).toBe("09 May 2026, 13:28");
    expect(formatDateTime("2026-05-09T23:05:00Z")).toBe("10 May 2026, 00:05");
  });
});
